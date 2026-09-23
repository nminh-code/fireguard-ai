import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { LatestFrameQueue } from '../latest-frame-queue.mjs';
import { readSettings } from '../config.mjs';
import { extractionArgs } from '../pipeline.mjs';

test('5 FPS ceiling preserves existing 1 FPS extraction and validates configuration', () => {
  const settings = readSettings({});
  assert.equal(settings.fps, 1);
  assert.equal(settings.targetFps, 5);
  for (const value of ['0', '-1', '6', 'NaN']) {
    assert.throws(() => readSettings({ AI_TARGET_FPS: value }));
  }
  const args = extractionArgs(readSettings({ AI_FRAME_FPS: '5', AI_TARGET_FPS: '2' }), 'rtsp://unused/onvif2');
  assert.ok(args[args.indexOf('-vf') + 1].includes('gte(t-prev_selected_t,0.5)'));
});

test('burst pacing retains newest frame, exact result frame, and cancels waiting work', async t => {
  const calls = [], results = [];
  const queue = new LatestFrameQueue(async frame => {
    calls.push({ frame, at: performance.now() });
    return { sequence: frame.sequence };
  }, (result, frame) => results.push({ result, frame }), assert.fail, false, { targetFps: 5 });
  t.after(() => queue.close());
  queue.offer({ sequence: 1 });
  await delay(10);
  for (let sequence = 2; sequence <= 20; sequence++) queue.offer({ sequence });
  assert.equal(calls.length, 1);
  assert.equal(queue.pending.sequence, 20);
  assert.equal(queue.dropped, 18);
  await delay(250);
  assert.deepEqual(calls.map(item => item.frame.sequence), [1, 20]);
  assert.ok(calls[1].at - calls[0].at >= 199);
  assert.equal(results[1].frame, calls[1].frame);
  queue.offer({ sequence: 21 });
  queue.close();
  await delay(250);
  assert.equal(calls.length, 2);
  assert.equal(queue.pending, null);
});
