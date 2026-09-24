import { parentPort, workerData } from 'node:worker_threads';
import { YoloProcessor } from './processors/yolo-fire-smoke.mjs';

const yolo = new YoloProcessor(workerData, {
  onSpawn: pid => parentPort.postMessage({ type: 'python', pid }),
});
let busy = false;
parentPort.on('message', async message => {
  if (message.type === 'close') {
    await yolo.stopYolo();
    parentPort.postMessage({ type: 'closed' });
    parentPort.close();
    return;
  }
  if (message.type !== 'frame' || busy) {
    parentPort.postMessage({ type: 'result', ok: false });
    return;
  }
  busy = true;
  try {
    const result = await yolo.inferFrame(message.frame);
    parentPort.postMessage({ type: 'result', ok: true, result });
  } catch {
    parentPort.postMessage({ type: 'result', ok: false });
  } finally { busy = false; }
});
yolo.ensureYolo().then(
  () => parentPort.postMessage({ type: 'ready' }),
  () => parentPort.postMessage({ type: 'failed' }),
);
