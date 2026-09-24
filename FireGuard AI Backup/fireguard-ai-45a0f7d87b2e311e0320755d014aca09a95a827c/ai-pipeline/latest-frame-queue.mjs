// A slow consumer gets the newest pending frame, not an ever-growing backlog.
export class LatestFrameQueue {
  constructor(processFrame, onResult, onError, paused = false) {
    this.processFrame = processFrame;
    this.onResult = onResult;
    this.onError = onError;
    this.busy = false;
    this.closed = false;
    this.pending = null;
    this.dropped = 0;
    this.processed = 0;
    this.paused = paused;
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
        const frame = this.pending;
        this.pending = null;
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
