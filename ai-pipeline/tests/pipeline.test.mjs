import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { once, EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { inflateSync } from 'node:zlib';
import { readSettings, cameraUrl } from '../config.mjs';
import { RawFrameDecoder } from '../raw-frame-decoder.mjs';
import { LatestFrameQueue } from '../latest-frame-queue.mjs';
import { ProcessorClient, processorEnvironment } from '../processor-client.mjs';
import { FramePipeline, extractionArgs, ffmpegDiagnostic } from '../pipeline.mjs';
import { createApp } from '../server.mjs';
import { YoloProcessor } from '../processors/yolo-fire-smoke.mjs';
import { AlertStore } from '../alert-store.mjs';
import { encodeRgbPng, EvidenceStore } from '../evidence-store.mjs';

// Protocol-only byte payloads and process doubles; never a runtime camera source.
const testEvidenceDirectory = mkdtempSync(path.join(tmpdir(), 'ai-evidence-test-'));
after(() => rmSync(testEvidenceDirectory, { recursive: true, force: true }));
const defaultSettings = { ...readSettings({ AI_FRAME_WIDTH: '32', AI_FRAME_HEIGHT: '32' }), evidenceDirectory: testEvidenceDirectory };
const settings = { ...defaultSettings, alertDelayMs: 0 };
const byteCount = settings.width * settings.height * 3;
const payload = () => Buffer.alloc(byteCount, 17);
const testUrl = 'rtsp://127.0.0.1:554/onvif2';

// Detection fixtures are confined to tests; runtime has no alert injection route.
const detection = (kind = 'fire', confidence = 0.837) => ({ class: kind, confidence, box: [1, 2, 20, 30] });
const inference = (frame, detections) => ({
  processor: 'yolo-fire-smoke', inferencePerformed: true, sequence: frame.sequence, detections,
});
function alertHarness(options = {}) {
  let time = 0;
  const store = new AlertStore({ cameraId: settings.cameraId, delayMs: 0, ...options, now: () => time });
  store.beginSession('session-one');
  const frame = sequence => ({
    cameraId: settings.cameraId, sessionId: store.sessionId, sequence,
    receivedAt: '2026-09-20T00:00:00.000Z', width: 32, height: 32,
  });
  const record = (sequence, detections) => { const f = frame(sequence); store.record(inference(f, detections), f); };
  return { store, frame, record, setTime: value => { time = value; } };
}

test('alert config is bounded and does not permit disabling spam protection', () => {
  assert.equal(settings.alertCooldownMs, 30000);
  assert.equal(defaultSettings.alertDelayMs, 3000);
  assert.equal(settings.alertCapacity, 100);
  for (const value of ['0', '-1', 'NaN', '9999999']) assert.throws(() => readSettings({ AI_ALERT_COOLDOWN_MS: value }));
  for (const value of ['-1', '1.5', '60001']) assert.throws(() => readSettings({ AI_ALERT_DELAY_MS: value }));
  for (const value of ['0', '1.5', '1001']) assert.throws(() => readSettings({ AI_ALERT_CAPACITY: value }));
});

test('alerts are not published until the configured 3-second delay has elapsed', () => {
  let scheduled;
  const { store, record } = alertHarness({
    delayMs: 3000,
    schedule: (callback, delay) => { scheduled = { callback, delay }; },
  });
  record(1, [detection()]);
  assert.equal(store.latest(), null);
  assert.equal(store.status().totalCreated, 0);
  assert.equal(store.status().delayMs, 3000);
  assert.equal(scheduled.delay, 3000);
  scheduled.callback();
  assert.equal(store.latest().sequence, 1);
  assert.equal(store.status().totalCreated, 1);
});

test('alerts require successful YOLO, valid geometry and confidence >= 0.5', () => {
  const { store, frame, record } = alertHarness();
  const f = frame(1);
  store.record({ ...inference(f, [detection()]), inferencePerformed: false }, f);
  store.record({ ...inference(f, [detection()]), processor: 'frame-probe' }, f);
  store.record(inference({ sequence: 99 }, [detection()]), f);
  record(1, [null, detection('person'), detection('fire', 0.4999), detection('smoke', NaN),
    detection('fire', Infinity), detection('fire', 1.01), detection('fire', '0.9'),
    { ...detection(), box: [1, 2, NaN, 4] }, { ...detection(), box: [1, 2, 3] },
    { ...detection(), box: [20, 2, 1, 3] }, { ...detection(), box: [-1, 2, 3, 4] },
    { ...detection(), box: [1, 2, 33, 34] }]);
  assert.equal(store.latest(), null);
  record(2, [detection('fire', 0.5), detection('smoke', 1)]);
  assert.equal(store.list().length, 2);
  const event = store.list().find(item => item.class === 'fire');
  assert.match(event.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual({ ...event, id: undefined }, {
    id: undefined, cameraId: settings.cameraId, sessionId: 'session-one',
    class: 'fire', confidence: 0.5, box: [1, 2, 20, 30], boxFormat: 'xyxy',
    timestamp: f.receivedAt, sequence: 2, width: 32, height: 32, evidenceUrl: null,
  });
});

test('evidence uses the original inference frame across alert delay and follows capacity', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ai-evidence-frame-'));
  try {
    let time = 0;
    const scheduled = [];
    const evidenceStore = new EvidenceStore(directory, 1);
    const store = new AlertStore({
      cameraId: settings.cameraId, delayMs: 3000, cooldownMs: 30000, capacity: 1,
      evidenceStore, now: () => time,
      schedule: (callback, delay) => { scheduled.push({ callback, delay }); },
    });
    store.beginSession('evidence-session');
    const makeFrame = (sequence, value) => ({
      cameraId: settings.cameraId, sessionId: store.sessionId, sequence,
      receivedAt: `2026-09-20T00:00:${String(sequence).padStart(2, '0')}.000Z`,
      width: 32, height: 32, data: Buffer.alloc(32 * 32 * 3, value),
    });
    const firstFrame = makeFrame(1, 17);
    store.record(inference(firstFrame, [detection()]), firstFrame);
    firstFrame.data.fill(99);
    assert.equal(store.latest(), null);
    assert.equal(readdirSync(directory).length, 0);
    assert.equal(scheduled[0].delay, 3000);
    scheduled[0].callback();
    const first = store.latest();
    assert.equal(first.sequence, 1);
    assert.match(first.evidenceUrl, new RegExp(`^/v1/evidence/${first.id}\\.png$`));
    const png = readFileSync(evidenceStore.pathFor(first.id));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const compressed = [];
    for (let offset = 8; offset < png.length;) {
      const length = png.readUInt32BE(offset);
      const type = png.toString('ascii', offset + 4, offset + 8);
      if (type === 'IDAT') compressed.push(png.subarray(offset + 8, offset + 8 + length));
      offset += length + 12;
    }
    assert.deepEqual([...inflateSync(Buffer.concat(compressed)).subarray(1, 4)], [17, 17, 17]);

    time = 30000;
    const secondFrame = makeFrame(2, 33);
    store.record(inference(secondFrame, [detection()]), secondFrame);
    scheduled[1].callback();
    assert.equal(store.latest().sequence, 2);
    assert.equal(readdirSync(directory).length, 1);
    assert.equal(existsSync(evidenceStore.pathFor(first.id)), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('evidence renderer draws FIRE and SMOKE boxes without mutating the inference frame', () => {
  const frame = { width: 64, height: 64, data: Buffer.alloc(64 * 64 * 3, 17) };
  const png = encodeRgbPng(frame, [
    { class: 'fire', confidence: 0.842, box: [10, 20, 30, 40] },
    { class: 'smoke', confidence: 0.765, box: [35, 20, 55, 40] },
  ]);
  const compressed = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') compressed.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const scanlines = inflateSync(Buffer.concat(compressed));
  const pixel = (x, y) => {
    const offset = y * (64 * 3 + 1) + 1 + x * 3;
    return [...scanlines.subarray(offset, offset + 3)];
  };
  assert.deepEqual(pixel(10, 20), [255, 64, 32]);
  assert.deepEqual(pixel(35, 20), [0, 128, 255]);
  assert.ok(scanlines.includes(Buffer.from([255, 255, 255]))); // Confidence-label glyphs.
  assert.ok(frame.data.every(value => value === 17));
});

test('cooldown chooses strongest box and does not slide on suppressed frames', () => {
  const { store, record, setTime } = alertHarness();
  const strongest = { ...detection('fire', 0.99), box: [3, 4, 25, 31] };
  record(1, [detection(), strongest]);
  assert.equal(store.status().totalCreated, 1);
  assert.equal(store.latest().confidence, 0.99);
  assert.deepEqual(store.latest().box, strongest.box);
  strongest.box[0] = 9;
  assert.equal(store.latest().box[0], 3);
  assert.throws(() => { store.latest().box[0] = 9; }, TypeError);
  for (let sequence = 2; sequence <= 30; sequence++) {
    setTime((sequence - 1) * 1000);
    record(sequence, [detection()]);
  }
  setTime(29999);
  record(31, [detection()]);
  assert.equal(store.status().totalCreated, 1);
  setTime(30000);
  record(32, [detection()]);
  assert.equal(store.status().totalCreated, 2);
  assert.equal(store.latest().sequence, 32);
  setTime(60000);
  record(32, [detection()]); // Replay never generates another alert.
  record(31, [detection()]);
  assert.equal(store.status().totalCreated, 2);
});

test('fire/smoke and cameras have independent cooldown; empty detections never emit or reset it', () => {
  const { store, record, setTime } = alertHarness();
  record(1, [detection()]);
  setTime(1000);
  record(2, []);
  record(3, [detection(), detection('smoke')]);
  assert.deepEqual(store.list().map(event => event.class), ['smoke', 'fire']);
  setTime(60000);
  record(4, []);
  assert.equal(store.status().totalCreated, 2);
  const other = alertHarness({ cameraId: 'another-camera' });
  const f = { ...other.frame(1), cameraId: 'another-camera' };
  other.store.record(inference(f, [detection()]), f);
  assert.equal(other.store.status().totalCreated, 1);
});

test('bounded history survives session restart, preserves cooldown and rejects old-session/camera results', () => {
  const { store, record, frame, setTime } = alertHarness({ capacity: 2 });
  record(1, [detection()]);
  const oldFrame = frame(2);
  store.beginSession('session-two');
  setTime(1000);
  record(1, [detection()]);
  assert.equal(store.latest().sessionId, 'session-one');
  setTime(30000);
  store.record(inference(oldFrame, [detection()]), oldFrame);
  const wrongCamera = { ...frame(2), cameraId: 'wrong-camera' };
  store.record(inference(wrongCamera, [detection()]), wrongCamera);
  assert.equal(store.status().totalCreated, 1);
  record(2, [detection()]);
  setTime(60000);
  record(3, [detection()]);
  assert.equal(store.status().totalCreated, 3);
  assert.equal(store.status().retained, 2);
  assert.deepEqual(store.list().map(event => event.sequence), [3, 2]);
  assert.equal(store.list(1)[0].sessionId, 'session-two');
  store.list().pop();
  assert.equal(store.status().retained, 2);
});

test('camera URL is constructed only from backend settings; secrets are not in public settings', () => {
  const env = { AI_RTSP_URL: testUrl, AI_CAMERA_USERNAME: 'unit-user', AI_CAMERA_PASSWORD: 'unit@:#%/?' };
  const url = new URL(cameraUrl(env));
  assert.equal(url.pathname, '/onvif2');
  assert.equal(decodeURIComponent(url.username), env.AI_CAMERA_USERNAME);
  assert.equal(decodeURIComponent(url.password), env.AI_CAMERA_PASSWORD);
  assert.ok(!JSON.stringify(readSettings(env)).includes(env.AI_CAMERA_PASSWORD));
  for (const invalid of ['file:///private', 'http://localhost/onvif2', 'rtsp://localhost/other', 'rtsp://u:p@localhost/onvif2']) {
    assert.throws(() => cameraUrl({ AI_RTSP_URL: invalid }));
  }
  assert.throws(() => readSettings({ AI_FRAME_FPS: '100' }));
  assert.throws(() => readSettings({ AI_FRAME_WIDTH: '99999' }));
});

test('FFmpeg extraction reads RTSP once, samples without CFR, writes only raw frames to stdout', () => {
  const args = extractionArgs(settings, testUrl);
  assert.equal(args.filter(arg => arg === '-i').length, 1);
  assert.equal(args[args.indexOf('-i') + 1], testUrl);
  assert.equal(args[args.indexOf('-rtsp_transport') + 1], 'udp');
  assert.equal(args[args.indexOf('-fps_mode') + 1], 'passthrough');
  assert.match(args[args.indexOf('-vf') + 1], /select=.*prev_selected_t/);
  assert.equal(args.at(-1), 'pipe:1');
  assert.ok(!args.some(arg => /hls|m3u8|segment_|lavfi|testsrc/.test(arg)));
});

test('raw decoder handles arbitrary chunk boundaries and does not mutate emitted frames', () => {
  const frames = [];
  const decoder = new RawFrameDecoder(12, frame => frames.push(frame));
  const bytes = Buffer.from(Array.from({ length: 39 }, (_, i) => i));
  for (const [from, to] of [[0, 1], [1, 8], [8, 33], [33, 39]]) decoder.push(bytes.subarray(from, to));
  assert.equal(frames.length, 3);
  assert.deepEqual(Buffer.concat(frames), bytes.subarray(0, 36));
  assert.equal(decoder.offset, 3);
  assert.equal(decoder.buffer.length, 12);
  const first = Buffer.from(frames[0]);
  decoder.push(Buffer.alloc(9, 200));
  assert.deepEqual(frames[0], first);
  decoder.push(Buffer.alloc(5));
  decoder.reset();
  assert.equal(decoder.offset, 0);
});

test('slow processor has at most one pending frame and receives newest frame next', async () => {
  const seen = [];
  const resolvers = [];
  const queue = new LatestFrameQueue(frame => {
    seen.push(frame.sequence);
    return new Promise(resolve => resolvers.push(resolve));
  }, () => {}, () => assert.fail('unexpected queue error'));
  queue.offer({ sequence: 1 });
  for (let i = 2; i <= 100; i++) queue.offer({ sequence: i });
  assert.deepEqual(seen, [1]);
  assert.equal(queue.pending.sequence, 100);
  assert.equal(queue.dropped, 98);
  resolvers.shift()({});
  await nextTurn();
  assert.deepEqual(seen, [1, 100]);
  resolvers.shift()({});
  await nextTurn();
  assert.equal(queue.processed, 2);
  assert.equal(queue.pending, null);
  queue.close();
});

test('closing queue discards pending and ignores a late processor result', async () => {
  let complete;
  let results = 0;
  const queue = new LatestFrameQueue(() => new Promise(resolve => { complete = resolve; }), () => results++, () => {});
  queue.offer({ sequence: 1 });
  queue.offer({ sequence: 2 });
  queue.close();
  complete({});
  await nextTurn();
  assert.equal(results, 0);
  assert.equal(queue.pending, null);
});

class ReplyWorker extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  constructor(_url, options) {
    super(); this.options = options;
    queueMicrotask(() => this.emit('message', { type: 'ready' }));
  }
  postMessage(message) {
    if (message.type === 'close') { this.emit('message', { type: 'closed' }); return; }
    this.frame = message.frame;
    queueMicrotask(() => this.emit('message', {
      type: 'result', ok: this.frame.data.length > 1,
      result: { processor: 'yolo-fire-smoke', inferencePerformed: true, sequence: this.frame.sequence, detections: [] },
    }));
  }
  async terminate() { return 0; }
}

test('client passes model config and isolates credentials without detaching original data', async t => {
  const client = new ProcessorClient(5000, { WorkerType: ReplyWorker, settings });
  t.after(() => client.close());
  const data = payload();
  const result = await client.process({ data, width: 32, height: 32, pixelFormat: 'rgb24', sequence: 1 });
  assert.equal(result.inferencePerformed, true);
  assert.equal(result.sequence, 1);
  assert.equal(data.byteLength, byteCount);
  assert.notEqual(client.worker.frame.data.buffer, data.buffer);
  assert.equal(client.worker.options.workerData.confidence, 0.5);
  assert.match(client.worker.options.workerData.model, /models[\\/]best.pt$/);
  assert.deepEqual(processorEnvironment({ Path: 'runtime', SystemRoot: 'windows', AI_CAMERA_PASSWORD: 'secret', AI_RTSP_URL: 'secret' }), { Path: 'runtime', SystemRoot: 'windows' });
});

test('worker failure does not expose input or exception details', async t => {
  const client = new ProcessorClient(5000, { WorkerType: ReplyWorker });
  t.after(() => client.close());
  await assert.rejects(client.process({ data: new Uint8Array(1) }), /PROCESSOR_FAILED/);
});

test('unresponsive processor is terminated after timeout, not left in the queue', async () => {
  let terminated = false;
  class SilentWorker extends EventEmitter {
    stdout = new PassThrough();
    stderr = new PassThrough();
    postMessage() {}
    async terminate() { terminated = true; return 0; }
  }
  const client = new ProcessorClient(10, { WorkerType: SilentWorker });
  client.worker.emit('message', { type: 'ready' });
  await assert.rejects(client.process({ data: new Uint8Array(3) }), /PROCESSOR_UNAVAILABLE/);
  await client.close();
  assert.equal(terminated, true);
  assert.equal(client.closed, true);
  await assert.rejects(client.process({ data: new Uint8Array(3) }), /PROCESSOR_UNAVAILABLE/);
});

function harness(processFrame = async frame => ({ sequence: frame.sequence }), overrides = {}) {
  const children = [];
  const processorFactory = () => ({ process: processFrame, close: async () => {} });
  const spawnProcess = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.exitCode = null;
    child.signalCode = null;
    child.signals = [];
    child.kill = signal => {
      child.signals.push(signal);
      queueMicrotask(() => { child.signalCode = signal; child.stdout.end(); child.stderr.end(); child.emit('close', null, signal); });
      return true;
    };
    children.push(child);
    return child;
  };
  return { pipeline: new FramePipeline({ ...settings, ...overrides }, { spawnProcess, processorFactory }), children };
}

test('pipeline generates alerts only from completed inference and ignores results after stop/restart', async t => {
  const pending = [];
  const { pipeline, children } = harness(frame => new Promise(resolve => pending.push(() => resolve(inference(frame, [detection()])))));
  t.after(() => pipeline.stop());
  pipeline.start(testUrl);
  children[0].stdout.write(payload());
  children[0].stdout.write(payload());
  assert.equal(pipeline.alerts.latest(), null);
  assert.equal(children.length, 1);
  const oldSession = pipeline.sessionId;
  await pipeline.stop();
  pipeline.start(testUrl);
  pending.shift()();
  await nextTurn();
  assert.equal(pipeline.alerts.latest(), null);
  children[1].stdout.write(payload());
  pending.shift()();
  await nextTurn();
  assert.equal(pipeline.alerts.latest().sessionId, pipeline.sessionId);
  assert.notEqual(pipeline.alerts.latest().sessionId, oldSession);
  assert.equal(pipeline.alerts.latest().sequence, 1);
  assert.equal(pipeline.status().processor.inferencePerformed, true);
  assert.equal(pipeline.status().alerts.totalCreated, 1);
});

test('alert HTTP API handles empty/history/latest/limits, polling CORS and preserves status API', async t => {
  let detections = [detection(), detection('fire', 0.7), detection('smoke', 0.6)];
  const { pipeline, children } = harness(async frame => inference(frame, detections));
  const server = createApp({ settings, pipeline, ffmpegAvailable: true, getCameraUrl: () => testUrl }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { await pipeline.stop(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = path => fetch(base + path);
  const post = path => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const empty = await (await get('/v1/alerts')).json();
  assert.deepEqual(empty.alerts, []);
  assert.equal(empty.pipelineState, 'IDLE');
  assert.equal((await (await get('/v1/alerts/latest')).json()).alert, null);
  await post('/v1/pipeline/start');
  children[0].stdout.write(payload());
  await nextTurn();
  const response = await get('/v1/alerts');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const first = await response.json();
  assert.equal(first.alerts.length, 2);
  assert.equal(first.totalCreated, 2);
  assert.equal(first.pipelineState, 'RUNNING');
  assert.equal(first.alerts[0].sessionId, pipeline.sessionId);
  assert.equal(first.alerts[0].cameraId, settings.cameraId);
  assert.equal(first.alerts[0].sequence, 1);
  assert.equal(first.alerts[0].timestamp, pipeline.latestFrame().receivedAt);
  assert.match(first.alerts[0].evidenceUrl, new RegExp(`^/v1/evidence/${first.alerts[0].id}\\.png$`));
  assert.ok(first.alerts.every(alert => typeof alert.evidenceUrl === 'string'));
  const evidence = await get(first.alerts[0].evidenceUrl);
  assert.equal(evidence.status, 200);
  assert.equal(evidence.headers.get('content-type'), 'image/png');
  assert.deepEqual([...new Uint8Array((await evidence.arrayBuffer()).slice(0, 8))], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal((await get('/v1/evidence/not-an-alert.png')).status, 404);
  const latest = await (await get('/v1/alerts/latest')).json();
  assert.deepEqual(latest.alert, first.alerts[0]);
  assert.equal(latest.latestId, latest.alert.id);
  assert.deepEqual((await (await get('/v1/alerts?limit=1')).json()).alerts, [latest.alert]);
  children[0].stdout.write(payload());
  await nextTurn();
  detections = [];
  children[0].stdout.write(payload());
  await nextTurn();
  assert.deepEqual((await (await get('/v1/alerts')).json()).alerts, first.alerts);
  const status = await (await get('/v1/pipeline/status')).json();
  assert.equal(status.processor.name, 'yolo-fire-smoke');
  assert.equal(status.processor.processedFrames, 3);
  assert.equal(status.alerts.totalCreated, 2);
  for (const query of ['limit=0', 'limit=-1', 'limit=101', 'limit=1.5', 'limit=NaN', 'limit=', 'limit=1&limit=2', 'limit[x]=1', 'other=1']) {
    assert.equal((await get('/v1/alerts?' + query)).status, 400, query);
  }
  for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000']) {
    const cors = await fetch(base + '/v1/alerts', { headers: { Origin: origin } });
    assert.equal(cors.status, 200);
    assert.equal(cors.headers.get('access-control-allow-origin'), origin);
    assert.match(cors.headers.get('vary'), /Origin/);
    const corsLatest = await fetch(base + '/v1/alerts/latest', { headers: { Origin: origin } });
    assert.equal(corsLatest.status, 200);
    assert.equal(corsLatest.headers.get('access-control-allow-origin'), origin);
    const control = await fetch(base + '/v1/pipeline/start', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(control.status, 403);
  }
  const denied = await fetch(base + '/v1/alerts', { headers: { Origin: 'http://localhost:3000.evil.invalid' } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
  assert.equal((await post('/v1/alerts')).status, 404);
  assert.equal(children.length, 1); // GET polling and repeated start never connect to RTSP.
  await post('/v1/pipeline/stop');
  const stopped = await (await get('/v1/alerts')).json();
  assert.equal(stopped.pipelineState, 'STOPPED');
  assert.deepEqual(stopped.alerts, first.alerts);
  await post('/v1/pipeline/start');
  detections = [detection()];
  children[1].stdout.write(payload());
  await nextTurn();
  const restarted = await (await get('/v1/alerts')).json();
  assert.notEqual(restarted.sessionId, first.sessionId);
  assert.deepEqual(restarted.alerts, first.alerts); // Cooldown survives a camera restart.
});

test('no-frame watchdog fails and closes owned process without an automatic reconnect', { timeout: 5000 }, async t => {
  const { pipeline, children } = harness(undefined, { connectTimeoutMs: 1 });
  t.after(() => pipeline.stop());
  pipeline.start(testUrl);
  await pipeline.closed;
  assert.equal(pipeline.state, 'FAILED');
  assert.equal(pipeline.error, 'NO_FRAMES_TIMEOUT');
  assert.deepEqual(children[0].signals, ['SIGTERM']);
  assert.equal(children.length, 1);
});

test('worker creation failure does not leave a misleading CONNECTING state', () => {
  let spawnCalls = 0;
  const pipeline = new FramePipeline(settings, {
    processorFactory: () => { throw new Error('unit worker failure'); },
    spawnProcess: () => { spawnCalls++; },
  });
  assert.equal(pipeline.start(testUrl).state, 'FAILED');
  assert.equal(pipeline.error, 'PROCESSOR_START_FAILED');
  assert.equal(spawnCalls, 0);
});

test('start/stop/start uses new session and stops only its owned child; no partial/old frame', async t => {
  const { pipeline, children } = harness();
  t.after(() => pipeline.stop());
  pipeline.start(testUrl);
  const firstSession = pipeline.sessionId;
  assert.equal(pipeline.state, 'CONNECTING');
  children[0].stdout.write(payload().subarray(0, byteCount - 1));
  assert.equal(pipeline.latestFrame(), null);
  children[0].stdout.write(Buffer.from([17]));
  assert.equal(pipeline.state, 'RUNNING');
  assert.equal(pipeline.latestFrame().sequence, 1);
  await pipeline.stop();
  assert.equal(pipeline.latestFrame(), null);
  assert.equal(pipeline.state, 'STOPPED');
  assert.deepEqual(children[0].signals, ['SIGTERM']);
  pipeline.start(testUrl);
  assert.notEqual(pipeline.sessionId, firstSession);
  assert.equal(pipeline.latestFrame(), null);
  assert.equal(pipeline.received, 0);
  await pipeline.stop();
  assert.deepEqual(children[1].signals, ['SIGTERM']);
  assert.deepEqual(children[0].signals, ['SIGTERM']);
});

test('processor failure leaves extraction alive with bounded queue', async t => {
  const { pipeline, children } = harness(async () => { throw new Error('unit exception'); });
  t.after(() => pipeline.stop());
  pipeline.start(testUrl);
  children[0].stdout.write(payload());
  await nextTurn();
  children[0].stdout.write(payload());
  assert.equal(pipeline.status().processor.state, 'FAILED');
  assert.equal(pipeline.status().processor.pendingFrames, 0);
  assert.equal(pipeline.state, 'RUNNING');
  assert.equal(pipeline.latestFrame().sequence, 2);
  assert.deepEqual(children[0].signals, []);
});

test('stale frames are refused and failure kills only the pipeline child', async t => {
  const { pipeline, children } = harness();
  t.after(() => pipeline.stop());
  pipeline.start(testUrl);
  children[0].stdout.write(payload());
  pipeline.lastFrameTime -= settings.staleMs + 1;
  assert.equal(pipeline.latestFrame(), null);
  pipeline.fail('FRAME_STALLED');
  await pipeline.closed;
  assert.equal(pipeline.state, 'FAILED');
  assert.equal(pipeline.error, 'FRAME_STALLED');
  assert.equal(pipeline.latestFrame(), null);
  assert.deepEqual(children[0].signals, ['SIGTERM']);
});

test('missing executable reports failure without attempting a camera connection', async t => {
  const pipeline = new FramePipeline({ ...settings, ffmpeg: './ai-pipeline/nonexistent-executable-for-unit-test' });
  t.after(() => pipeline.stop());
  pipeline.start(testUrl);
  await pipeline.closed;
  assert.equal(pipeline.state, 'FAILED');
  assert.equal(pipeline.error, 'FFMPEG_START_FAILED');
});

test('HTTP API is idle by default, start idempotent, raw bytes exact, no credentials/cache', async t => {
  const { pipeline, children } = harness();
  const secret = 'unit-only-private-value';
  const server = createApp({ settings, pipeline, ffmpegAvailable: true, getCameraUrl: () => `rtsp://unit:${secret}@localhost/onvif2` }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { await pipeline.stop(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = endpoint => fetch(base + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  let response = await fetch(base + '/v1/pipeline/status');
  assert.equal((await response.json()).state, 'IDLE');
  assert.equal(children.length, 0);
  assert.equal((await fetch(base + '/v1/frames/latest')).status, 503);
  assert.equal((await post('/v1/pipeline/start')).status, 202);
  assert.equal((await post('/v1/pipeline/start')).status, 200);
  assert.equal(children.length, 1);
  children[0].stdout.write(payload());
  await nextTurn();
  response = await fetch(base + '/v1/frames/latest');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-frame-format'), 'rgb24');
  assert.equal(response.headers.get('x-frame-sequence'), '1');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), payload());
  const status = await (await fetch(base + '/v1/pipeline/status')).text();
  assert.ok(!status.includes(secret));
  assert.ok(!status.includes('rtsp://'));
  assert.equal((await fetch(base + '/v1/pipeline/start', {
    method: 'POST', headers: { Origin: 'https://untrusted.invalid', 'Content-Type': 'application/json' }, body: '{}',
  })).status, 403);
  assert.equal((await fetch(base + '/v1/pipeline/start', { method: 'POST' })).status, 415);
  assert.equal((await fetch(base + '/v1/pipeline/start', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json',
  })).status, 400);
  await post('/v1/pipeline/stop');
  assert.equal((await fetch(base + '/v1/frames/latest')).status, 503);
});

test('model loading retains only latest frame before first inference', async () => {
  const seen = [];
  const queue = new LatestFrameQueue(async frame => { seen.push(frame.sequence); }, () => {}, () => {}, true);
  for (let i = 1; i <= 100; i++) queue.offer({ sequence: i });
  assert.deepEqual(seen, []);
  assert.equal(queue.pending.sequence, 100);
  assert.equal(queue.dropped, 99);
  queue.resume();
  await nextTurn();
  assert.deepEqual(seen, [100]);
  queue.close();
});

test('status identifies YOLO and reports success only after a completed inference', async t => {
  const { pipeline, children } = harness(async frame => ({
    processor: 'yolo-fire-smoke', inferencePerformed: true,
    sequence: frame.sequence, timestamp: frame.receivedAt, detections: [],
  }));
  t.after(() => pipeline.stop());
  pipeline.start(testUrl);
  assert.equal(pipeline.status().processor.name, 'yolo-fire-smoke');
  assert.equal(pipeline.status().processor.inferencePerformed, false);
  children[0].stdout.write(payload());
  await nextTurn();
  const status = pipeline.status();
  assert.equal(status.processor.inferencePerformed, true);
  assert.equal(status.processor.lastResult.sequence, 1);
  assert.equal(status.processor.lastResult.timestamp, status.lastFrameAt);
  assert.equal(status.receivedBytes, byteCount);
});

test('FFmpeg diagnostics handle split messages and never publish raw credentials', async t => {
  const { pipeline, children } = harness();
  t.after(() => pipeline.stop());
  pipeline.start(testUrl);
  children[0].stderr.write('rtsp://user:private@camera/onvif2: 401 Unauth');
  children[0].stderr.write('orized');
  assert.equal(pipeline.status().diagnostic, 'RTSP_AUTH_FAILED');
  assert.ok(!JSON.stringify(pipeline.status()).includes('private'));
  assert.equal(ffmpegDiagnostic('Connection refused'), 'RTSP_CONNECTION_REFUSED');
  assert.equal(ffmpegDiagnostic('arbitrary private text'), null);
});

function pythonDouble() {
  const child = new EventEmitter();
  child.pid = undefined;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.exitCode = null;
  child.signalCode = null;
  child.kill = () => { child.signalCode = 'SIGTERM'; queueMicrotask(() => child.emit('close')); };
  return child;
}

test('YOLO bridge frames binary RGB, correlates results, rejects busy/error responses and reaps Python', async t => {
  const child = pythonDouble();
  const adapter = new YoloProcessor({}, { spawnProcess: () => child });
  t.after(() => adapter.stopYolo());
  const ready = adapter.ensureYolo();
  child.stdout.write('{"type":"rea');
  child.stdout.write('dy"}\n');
  await ready;
  const frame = { data: payload(), width: 32, height: 32, pixelFormat: 'rgb24', sequence: 7, receivedAt: '2026-09-19T00:00:00.000Z' };
  const resultPromise = adapter.inferFrame(frame);
  await nextTurn();
  await assert.rejects(adapter.inferFrame(frame), /YOLO_UNAVAILABLE/);
  const written = child.stdin.read();
  const newline = written.indexOf(10);
  assert.equal(JSON.parse(written.subarray(0, newline)).timestamp, frame.receivedAt);
  assert.deepEqual(written.subarray(newline + 1), frame.data);
  child.stdout.write(JSON.stringify({ type: 'result', ok: true, sequence: 7, detections: [{ class: 'fire', confidence: 0.9, box: [1, 2, 3, 4], sequence: 7, timestamp: frame.receivedAt }] }) + '\n');
  const result = await resultPromise;
  assert.equal(result.inferencePerformed, true);
  assert.equal(result.timestamp, frame.receivedAt);
  assert.equal(result.detections[0].class, 'fire');
  const failed = adapter.inferFrame({ ...frame, sequence: 8 });
  await nextTurn();
  child.stdout.write('{"type":"result","ok":false}\n');
  await assert.rejects(failed, /YOLO_INFERENCE_FAILED/);
  await adapter.stopYolo();
  assert.equal(child.signalCode, 'SIGTERM');
});

test('YOLO spawn failure and unexpected exit reject readiness/in-flight inference', async () => {
  const bad = pythonDouble();
  const adapter = new YoloProcessor({}, { spawnProcess: () => bad });
  const ready = adapter.ensureYolo();
  bad.emit('error', new Error('secret path'));
  await assert.rejects(ready, /YOLO_START_FAILED/);
  await adapter.stopYolo();
  const child = pythonDouble();
  const running = new YoloProcessor({}, { spawnProcess: () => child });
  const loaded = running.ensureYolo();
  child.stdout.write('{"type":"ready"}\n');
  await loaded;
  const inference = running.inferFrame({ data: payload(), width: 32, height: 32, pixelFormat: 'rgb24', sequence: 1 });
  await nextTurn();
  child.exitCode = 1;
  child.emit('close');
  await assert.rejects(inference, /YOLO_PROCESS_EXITED/);
  await running.stopYolo();
});

test('real FFmpeg RGB -> queue -> YOLO best.pt -> HTTP status, then reap owned processes', {
  skip: process.env.AI_TEST_YOLO !== '1', timeout: 150000,
}, async t => {
  const { spawn } = await import('node:child_process');
  const { setTimeout: delay } = await import('node:timers/promises');
  const { loadEnvironment } = await import('../config.mjs');
  loadEnvironment();
  const integrationEvidenceDirectory = mkdtempSync(path.join(tmpdir(), 'ai-evidence-integration-'));
  t.after(() => rmSync(integrationEvidenceDirectory, { recursive: true, force: true }));
  const actualSettings = { ...readSettings(), evidenceDirectory: integrationEvidenceDirectory };
  let spawns = 0;
  const pipeline = new FramePipeline({ ...actualSettings, connectTimeoutMs: 60000 }, {
    spawnProcess: (executable, _cameraArgs, options) => {
      spawns++;
      return spawn(executable, [
        '-hide_banner', '-loglevel', 'error', '-nostdin', '-re',
        '-f', 'lavfi', '-i', `testsrc=size=${actualSettings.width}x${actualSettings.height}:rate=1`,
        '-pix_fmt', 'rgb24', '-threads', '1', '-f', 'rawvideo', 'pipe:1',
      ], options);
    },
  });
  const server = createApp({ settings: actualSettings, pipeline, ffmpegAvailable: true, getCameraUrl: () => testUrl }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { await pipeline.stop(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = action => fetch(`${base}/v1/pipeline/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal((await post('start')).status, 202);
  assert.equal((await post('start')).status, 200);
  const deadline = Date.now() + 130000;
  while (pipeline.status().processor.processedFrames < 2 && Date.now() < deadline) {
    assert.notEqual(pipeline.state, 'FAILED');
    assert.notEqual(pipeline.processorState, 'FAILED');
    await delay(200);
  }
  const status = await (await fetch(`${base}/v1/pipeline/status`)).json();
  assert.equal(status.state, 'RUNNING');
  assert.equal(status.processor.name, 'yolo-fire-smoke');
  assert.equal(status.processor.inferencePerformed, true);
  assert.ok(status.processor.processedFrames >= 2);
  assert.ok(status.processor.pendingFrames <= 1);
  assert.equal(status.processor.lastResult.timestamp, status.processor.lastResult.receivedAt);
  assert.ok(Array.isArray(status.processor.lastResult.detections));
  assert.equal(spawns, 1);
  const pythonPid = pipeline.processor.pythonPid;
  assert.ok(pythonPid > 0);
  await post('stop');
  assert.equal(pipeline.status().processor.state, 'STOPPED');
  assert.equal(pipeline.processor.pythonPid, null);
  assert.throws(() => process.kill(pythonPid, 0), { code: 'ESRCH' });
});
