import { parentPort } from 'node:worker_threads';
import { processFrame } from './processors/frame-probe.mjs';

parentPort.on('message', async frame => {
  try {
    parentPort.postMessage({ ok: true, result: await processFrame(frame) });
  } catch {
    // Do not expose model exception text or input data to API/logs.
    parentPort.postMessage({ ok: false });
  }
});
