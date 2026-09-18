import { Worker } from 'node:worker_threads';

// CPU-bound model work runs outside the API/ingestion event loop.
export class ProcessorClient {
  constructor(timeoutMs, { WorkerType = Worker } = {}) {
    this.timeoutMs = timeoutMs;
    this.pending = null;
    this.closed = false;
    this.worker = new WorkerType(new URL('./processor-worker.mjs', import.meta.url), {
      env: {}, // A model worker does not need camera credentials.
      execArgv: [], // Do not inherit CLI-only flags such as --input-type or inspector options.
      stdout: true,
      stderr: true,
      resourceLimits: { maxOldGenerationSizeMb: 128 },
    });
    this.worker.stdout.resume();
    this.worker.stderr.resume();
    this.worker.on('message', message => {
      const pending = this.pending;
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending = null;
      if (message.ok) pending.resolve(message.result);
      else pending.reject(new Error('PROCESSOR_FAILED'));
    });
    this.worker.on('error', () => { void this.close(); });
    this.worker.on('exit', () => { void this.close(); });
  }

  process(frame) {
    if (this.closed || this.pending) return Promise.reject(new Error('PROCESSOR_UNAVAILABLE'));
    // Transfer an owned copy. The latest-frame API must keep its original buffer.
    const data = new Uint8Array(frame.data);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { void this.close(); }, this.timeoutMs);
      this.pending = { resolve, reject, timer };
      try { this.worker.postMessage({ ...frame, data }, [data.buffer]); }
      catch { void this.close(); }
    });
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error('PROCESSOR_UNAVAILABLE'));
      this.pending = null;
    }
    await this.worker.terminate();
  }
}
