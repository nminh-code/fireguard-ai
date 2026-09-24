// A slow consumer gets the newest pending frame, not an ever-growing backlog.
export class LatestFrameQueue {
  constructor(processFrame, onResult, onError, paused = false, options = {}) {
    this.processFrame = processFrame;
    this.onResult = onResult;
    this.onError = onError;
    this.busy = false;
    this.closed = false;
    this.pending = null;
    this.dropped = 0;
    this.processed = 0;
    this.paused = paused;
    this.targetFps = options?.targetFps || null;
    this.lastProcessedAt = 0;
  }

  offer(frame) {
    if (this.closed) return;
    if (this.pending) this.dropped++;
    this.pending = frame;
    if (!this.busy && !this.paused) void this.drain();
  }

  resume() {
    this.paused = false;
    if (!this.closed && this.pending && !this.busy) void this.drain();
  }

  async drain() {
    this.busy = true;
    try {
      while (this.pending && !this.closed) {
        if (this.targetFps && this.lastProcessedAt) {
          const minInterval = 1000 / this.targetFps;
          const elapsed = performance.now() - this.lastProcessedAt;
          if (elapsed < minInterval) {
            await new Promise(resolve => setTimeout(resolve, minInterval - elapsed));
          }
        }
        if (this.closed || !this.pending) break;
        const frame = this.pending;
        this.pending = null;
        this.lastProcessedAt = performance.now();
        const result = await this.processFrame(frame);
        if (this.closed) break;
        this.processed++;
        this.onResult(result, frame);
      }
    } catch {
      if (!this.closed) {
        this.close();
        this.onError();
      }
    } finally {
      this.busy = false;
    }
  }

  close() {
    this.closed = true;
    this.pending = null;
  }
}

