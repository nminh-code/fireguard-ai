import { createHash } from 'node:crypto';

/**
 * Processor contract: async processFrame({ data: Uint8Array, width, height,
 * pixelFormat: 'rgb24', sequence, receivedAt, cameraId, sessionId }).
 * data is packed RGB, row-major, width * height * 3 bytes (NOT JPEG/BGR).
 * receivedAt is backend receive time, not the camera's capture timestamp.
 * Replace this module with a model adapter later; no inference is performed now.
 */
export async function processFrame(frame) {
  if (frame.pixelFormat !== 'rgb24' || frame.data.byteLength !== frame.width * frame.height * 3) {
    throw new Error('Invalid RGB frame.');
  }
  return {
    processor: 'frame-probe',
    inferencePerformed: false,
    sequence: frame.sequence,
    receivedAt: frame.receivedAt,
    bytes: frame.data.byteLength,
    sha256: createHash('sha256').update(frame.data).digest('hex'),
  };
}
