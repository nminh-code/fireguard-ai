// stdout chunks do not line up with frame boundaries. Assemble exactly one RGB24
// frame at a time; never emit partial frames and never grow an unbounded buffer.
export class RawFrameDecoder {
  constructor(frameBytes, onFrame) {
    if (!Number.isSafeInteger(frameBytes) || frameBytes < 1) throw new Error('Invalid frame size.');
    this.frameBytes = frameBytes;
    this.onFrame = onFrame;
    this.reset();
  }

  reset() {
    this.buffer = Buffer.allocUnsafe(this.frameBytes);
    this.offset = 0;
  }

  push(chunk) {
    let cursor = 0;
    while (cursor < chunk.length) {
      const size = Math.min(this.frameBytes - this.offset, chunk.length - cursor);
      chunk.copy(this.buffer, this.offset, cursor, cursor + size);
      this.offset += size;
      cursor += size;
      if (this.offset === this.frameBytes) {
        const frame = this.buffer;
        this.reset();
        this.onFrame(frame);
      }
    }
  }
}
