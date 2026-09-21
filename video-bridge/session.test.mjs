import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { BridgeSession, readHls, ffmpegArgs } from './session.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, timeout = 2000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) assert.fail('Condition timed out');
    await sleep(5);
  }
}
function publish(dir, first = 0) {
  const names = Array.from({ length: 3 }, (_, i) => `segment_${String(first + i).padStart(5, '0')}.ts`);
  for (const name of names) writeFileSync(path.join(dir, name), 'segment');
  writeFileSync(path.join(dir, 'index.m3u8'), `#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:${first}\n${names.map(n => `#EXTINF:2,\n${n}`).join('\n')}\n`);
}
function fixture(t, overrides = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'bridge-test-'));
  const children = [];
  let live = 0;
  const spawnProcess = () => {
    assert.equal(live, 0, 'Never overlap FFmpeg writers');
    live++;
    const child = new EventEmitter();
    Object.assign(child, { exitCode: null, signalCode: null, killed: false,
      stdout: new PassThrough(), stderr: new PassThrough(), signals: [] });
    child.finish = () => {
      if (child.done) return;
      child.done = true;
      child.exitCode = 1;
      child.emit('exit', 1);
      setTimeout(() => { live--; child.emit('close', 1); }, 15);
    };
    child.kill = signal => {
      child.killed = true;
      child.signals.push(signal);
      if (!overrides.ignoreTerm || signal === 'SIGKILL') child.finish();
      return true;
    };
    children.push(child);
    return child;
  };
  const session = new BridgeSession({ ffmpeg: 'unused', rtspUrl: 'rtsp://user:secret@camera/onvif2',
    outputDir: dir, streamId: 'test', sourceKey: 'camera/onvif2', spawnProcess,
    staleMs: 100, delayMs: 20, tickMs: 5, killMs: 30, maxReconnects: 2, ...overrides });
  t.after(async () => { await session.stop(); rmSync(dir, { recursive: true, force: true }); });
  return { session, children, dir };
}

test('UDP receive buffer and atomic HLS options remain enabled', () => {
  const args = ffmpegArgs('rtsp://camera/onvif2');
  assert.equal(args[args.indexOf('-rtsp_transport') + 1], 'udp');
  assert.equal(args[args.indexOf('-buffer_size') + 1], '4194304');
  assert.match(args[args.indexOf('-hls_flags') + 1], /temp_file.*append_list/);
  assert.ok(!args.includes('tcp'));
});

test('exit reconnect waits for close; old playlist cannot report CONNECTED', async t => {
  const { session, children, dir } = fixture(t, { staleMs: 1000 });
  session.start();
  assert.equal(session.snapshot().status, 'CONNECTING');
  publish(dir);
  assert.equal(session.snapshot().status, 'CONNECTED');
  children[0].finish();
  await until(() => children.length === 2);
  assert.equal(session.snapshot().status, 'CONNECTING');
  assert.equal(readHls(dir).segments.length, 3);
  publish(dir, 3);
  assert.equal(session.snapshot().status, 'CONNECTED');
});

test('segment stall restarts even when playlist is being touched; retry budget is finite', async t => {
  const { session, children, dir } = fixture(t);
  session.start();
  publish(dir);
  const playlist = readHls(dir).playlist;
  const touch = setInterval(() => writeFileSync(path.join(dir, 'index.m3u8'), playlist), 10);
  t.after(() => clearInterval(touch));
  await until(() => session.failed);
  assert.equal(children.length, 3);
  assert.equal(session.snapshot().status, 'NOT_CONNECTED');
});

test('force kill is awaited and disconnect cancels queued reconnect', async t => {
  const { session, children } = fixture(t, { ignoreTerm: true, delayMs: 100 });
  session.start();
  await until(() => children[0].signals.includes('SIGKILL'));
  await until(() => session.reconnects === 1);
  await session.stop();
  await sleep(150);
  assert.equal(children.length, 1);
});

test('missing segment is never CONNECTED', async t => {
  const { session, dir } = fixture(t);
  session.start();
  publish(dir);
  rmSync(path.join(dir, 'segment_00001.ts'));
  assert.equal(session.snapshot().status, 'CONNECTING');
});

test('an unkillable child blocks replacements and retains ownership', async t => {
  const { session, children } = fixture(t);
  session.start();
  children[0].kill = () => false;
  await until(() => session.failed);
  assert.equal(children.length, 1);
  assert.equal(session.closed, false);
  await assert.rejects(session.stop(), /replacement is blocked/);
  children[0].finish();
  await until(() => session.closed);
});

test('spawn failure retries within budget without an unhandled error', async t => {
  const { session, children } = fixture(t);
  session.start();
  children[0].emit('error', new Error('Do not expose raw credentialed spawn errors'));
  children[0].finish();
  await until(() => children.length === 2);
  assert.equal(session.snapshot().status, 'CONNECTING');
});

const ffmpeg = process.env.FFMPEG_PATH || 'D:/ffmpeg-9.0.1-essentials_build/bin/ffmpeg.exe';
test('real FFmpeg appends playable HLS with increasing sequence and restart discontinuity',
  { skip: !existsSync(ffmpeg), timeout: 20000 }, async t => {
    const dir = mkdtempSync(path.join(tmpdir(), 'bridge-hls-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    async function produce() {
      const args = ffmpegArgs('unused');
      const output = args.slice(args.indexOf('-map'));
      const child = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
        'testsrc2=size=160x120:rate=15', '-t', '24', ...output], { cwd: dir, windowsHide: true });
      child.stderr.resume();
      child.stdout.resume();
      await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', code => code === 0 ? resolve() : reject(Error(`FFmpeg exit ${code}`)));
      });
    }
    await produce();
    const before = readHls(dir);
    // Short second run keeps the boundary in the rolling playlist.
    const args = ffmpegArgs('unused');
    const child = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
      'testsrc2=size=160x120:rate=15', '-t', '6', ...args.slice(args.indexOf('-map'))],
      { cwd: dir, windowsHide: true });
    child.stderr.resume(); child.stdout.resume();
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', code => code === 0 ? resolve() : reject(Error(`FFmpeg exit ${code}`)));
    });
    const after = readHls(dir);
    assert.ok(after.sequence > before.sequence);
    assert.notEqual(after.lastSegment, before.lastSegment);
    assert.match(after.playlist, /#EXT-X-DISCONTINUITY\n#EXTINF/);
    for (const segment of before.segments) assert.ok(existsSync(path.join(dir, segment)));
  });
