import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { VlcRelay } from './vlc-relay.mjs';

function fixture(t, { fetchStream, ignoreTerm = false, unkillable = false } = {}) {
  const child = new EventEmitter();
  Object.assign(child, { stderr: new PassThrough(), signals: [], exitCode: null });
  child.kill = signal => {
    child.signals.push(signal);
    if (!unkillable && (!ignoreTerm || signal === 'SIGKILL')) {
      setTimeout(() => { child.exitCode = 0; child.emit('close', 0); }, 5);
    }
    return true;
  };
  const launches = [];
  const relay = new VlcRelay({ executable: 'test-vlc', source: 'rtsp://user:private-password@camera/live',
    transport: 'udp', fps: 15, cachingMs: 1000, killMs: 20,
    allocatePort: async () => 19000,
    spawnProcess: (...args) => { launches.push(args); return child; },
    fetchStream: fetchStream || (async () => new Response(new Uint8Array([0x47, ...new Uint8Array(187)]))),
  });
  t.after(async () => {
    if (unkillable && !relay.closed) child.emit('close', 0);
    await relay.stop().catch(() => {});
  });
  return { relay, child, launches };
}

test('readiness waits for MPEG-TS data; an empty HTTP 200 cannot report video ready', async t => {
  let calls = 0, canceled = false;
  const { relay, launches } = fixture(t, { fetchStream: async () => {
    calls++;
    if (calls === 1) return new Response(new Uint8Array());
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array([0x47, ...new Uint8Array(187)])); },
      cancel() { canceled = true; },
    }));
  } });
  assert.equal(await relay.start(), 'http://127.0.0.1:19000/live.ts');
  assert.equal(calls, 2);
  assert.equal(relay.ready, true);
  assert.equal(canceled, true, 'the readiness consumer must release the local stream');
  assert.equal(launches.length, 1);
  assert.equal(launches[0][2].windowsHide, true);
  assert.ok(launches[0][1].includes('--no-one-instance'));
  assert.ok(launches[0][1].includes('--no-sout-audio'));
});

test('disconnect aborts an in-flight media request and never publishes a ready relay', async t => {
  let entered;
  const insideFetch = new Promise(resolve => { entered = resolve; });
  const { relay, child } = fixture(t, { fetchStream: async (_url, { signal }) => {
    entered();
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  const starting = assert.rejects(relay.start(), /VLC chưa nhận/);
  await insideFetch;
  await relay.stop();
  await starting;
  assert.equal(relay.closed, true);
  assert.equal(relay.ready, false);
  assert.equal(relay.source, '');
  assert.deepEqual(child.signals, ['SIGTERM']);
});

test('termination escalates and waits for close before releasing the VLC process', async t => {
  const { relay, child } = fixture(t, { ignoreTerm: true });
  await relay.start();
  await relay.stop();
  assert.deepEqual(child.signals, ['SIGTERM', 'SIGKILL']);
  assert.equal(relay.closed, true);
});

test('an unkillable relay reports failure instead of claiming it has stopped', async t => {
  const { relay } = fixture(t, { unkillable: true });
  await relay.start();
  await assert.rejects(relay.stop(), /VLC cũ chưa dừng/);
  assert.equal(relay.closed, false);
});

test('spawn errors produce a fixed message without exposing the credentialed URL', async t => {
  const { relay, child } = fixture(t, { fetchStream: async () => {
    child.emit('error', new Error('Cannot open rtsp://user:private-password@camera/live'));
    child.emit('close', -1);
    throw new Error('startup failed');
  } });
  await assert.rejects(relay.start(), error => error.message === 'Không khởi chạy được VLC.');
  assert.equal(relay.ready, false);
});
