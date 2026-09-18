import test from 'node:test';
import assert from 'node:assert/strict';
import { once, EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { readSettings, cameraUrl } from '../config.mjs';
import { RawFrameDecoder } from '../raw-frame-decoder.mjs';
import { LatestFrameQueue } from '../latest-frame-queue.mjs';
import { ProcessorClient } from '../processor-client.mjs';
import { FramePipeline, extractionArgs } from '../pipeline.mjs';
import { createApp } from '../server.mjs';

// Protocol-only byte payloads and process doubles; never a runtime camera source.
const settings = readSettings({ AI_FRAME_WIDTH: '32', AI_FRAME_HEIGHT: '32' });
const byteCount = settings.width * settings.height * 3;
const payload = () => Buffer.alloc(byteCount, 17);
const testUrl = 'rtsp://127.0.0.1:554/onvif2';

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

test('actual worker checks bytes and checksum without inference or detaching original data', async t => {
  const client = new ProcessorClient(5000);
  t.after(() => client.close());
  const data = payload();
  const result = await client.process({ data, width: 32, height: 32, pixelFormat: 'rgb24', sequence: 1 });
  assert.equal(result.bytes, byteCount);
  assert.equal(result.inferencePerformed, false);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
  assert.equal(data.byteLength, byteCount);
  assert.equal(data[0], 17);
});

test('worker failure does not expose input or exception details', async t => {
  const client = new ProcessorClient(5000);
  t.after(() => client.close());
  await assert.rejects(client.process({ data: new Uint8Array(1), width: 32, height: 32, pixelFormat: 'rgb24' }), /PROCESSOR_FAILED/);
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
  await assert.rejects(client.process({ data: new Uint8Array(3) }), /PROCESSOR_UNAVAILABLE/);
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
