import { Worker } from 'node:worker_threads';

// Only runtime variables needed by Python/Windows, never camera credentials.
export function processorEnvironment(env = process.env) {
  const allowed = /^(path|systemroot|windir|temp|tmp|userprofile|localappdata|appdata|programdata|programfiles|programfiles\(x86\)|virtual_env|conda_prefix|cuda_path)$/i;
  return Object.fromEntries(Object.entries(env).filter(([key]) => allowed.test(key)));
}

export class ProcessorClient {
  constructor(timeoutMs, { WorkerType = Worker, settings = {} } = {}) {
    this.timeoutMs = timeoutMs;
    this.pending = null;
    this.closed = false;
    this.ready = new Promise((resolve, reject) => { this.resolveReady = resolve; this.rejectReady = reject; });
    // A worker may fail before a frame arrives.
    this.ready.catch(() => {});
    this.worker = new WorkerType(new URL('./processor-worker.mjs', import.meta.url), {
      env: processorEnvironment(),
      workerData: { python: settings.python, model: settings.model, confidence: settings.confidence },
      execArgv: [], stdout: true, stderr: true,
      resourceLimits: { maxOldGenerationSizeMb: 128 },
    });
    this.worker.stdout.resume();
    this.worker.stderr.resume();
    this.loadTimer = setTimeout(() => { void this.close(); }, settings.modelLoadTimeoutMs ?? 120000);
    this.worker.on('message', message => {
      if (message.type === 'python') { this.pythonPid = message.pid; return; }
      if (message.type === 'closed') { this.pythonPid = null; this.didClose?.(); return; }
      if (message.type === 'ready') { clearTimeout(this.loadTimer); this.resolveReady(); return; }
      if (message.type === 'failed') { void this.close(); return; }
      const pending = this.pending;
      if (message.type !== 'result' || !pending) return;
      clearTimeout(pending.timer);
      this.pending = null;
      if (message.ok && message.result?.inferencePerformed === true) pending.resolve(message.result);
      else pending.reject(new Error('PROCESSOR_FAILED'));
    });
    this.worker.on('error', () => { void this.close(); });
    this.worker.on('exit', () => { void this.close(); });
  }

  async process(frame) {
    await this.ready;
    if (this.closed || this.pending) throw new Error('PROCESSOR_UNAVAILABLE');
    const data = new Uint8Array(frame.data);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { void this.close(); }, this.timeoutMs);
      this.pending = { resolve, reject, timer };
      try { this.worker.postMessage({ type: 'frame', frame: { ...frame, data } }, [data.buffer]); }
      catch { void this.close(); }
    });
  }

  close() {
    if (this.closing) return this.closing;
    this.closed = true;
    clearTimeout(this.loadTimer);
    this.rejectReady(new Error('PROCESSOR_UNAVAILABLE'));
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error('PROCESSOR_UNAVAILABLE'));
      this.pending = null;
    }
    this.closing = (async () => {
      // Give the worker a chance to reap Python before terminating the thread.
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 1500);
        this.didClose = () => { clearTimeout(timer); resolve(); };
        try { this.worker.postMessage({ type: 'close' }); } catch { this.didClose(); }
      });
      if (this.pythonPid) {
        try { process.kill(this.pythonPid, 'SIGKILL'); } catch { /* Already exited. */ }
        this.pythonPid = null;
      }
      await this.worker.terminate();
    })();
    return this.closing;
  }
}
