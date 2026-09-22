import fs from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const body = Buffer.concat([name, data]);
  const size = Buffer.allocUnsafe(4);
  const checksum = Buffer.allocUnsafe(4);
  size.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([size, body, checksum]);
}

// Encode the RGB24 buffer already consumed by YOLO. No camera or stream is opened here.
export function encodeRgbPng(frame) {
  const { data, width, height } = frame;
  if (!Buffer.isBuffer(data) || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || data.length !== width * height * 3) throw new Error('INVALID_EVIDENCE_FRAME');
  const stride = width * 3;
  const scanlines = Buffer.allocUnsafe((stride + 1) * height);
  for (let row = 0; row < height; row++) {
    const output = row * (stride + 1);
    scanlines[output] = 0;
    data.copy(scanlines, output + 1, row * stride, (row + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines, { level: 3 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export class EvidenceStore {
  constructor(directory, capacity = 100) {
    this.directory = directory;
    this.capacity = capacity;
    this.ids = [];
    fs.mkdirSync(directory, { recursive: true });
    // Alert history is memory-only, so files from an earlier backend process are unreachable.
    for (const name of fs.readdirSync(directory)) {
      if (UUID.test(path.parse(name).name) && path.extname(name).toLowerCase() === '.png') {
        try { fs.unlinkSync(path.join(directory, name)); } catch { /* Best-effort stale cleanup. */ }
      }
    }
  }

  prepare(id, frame) {
    if (!UUID.test(id)) throw new Error('INVALID_EVIDENCE_ID');
    const png = encodeRgbPng(frame);
    let committed = false;
    return {
      url: `/v1/evidence/${id}.png`,
      commit: () => {
        if (committed) return;
        fs.writeFileSync(this.pathFor(id), png, { flag: 'wx' });
        committed = true;
        this.ids.push(id);
        while (this.ids.length > this.capacity) this.delete(this.ids[0]);
      },
    };
  }

  delete(id) {
    if (!UUID.test(id)) return;
    try { fs.unlinkSync(this.pathFor(id)); } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    this.ids = this.ids.filter(item => item !== id);
  }

  pathFor(id) {
    if (!UUID.test(id)) return null;
    return path.join(this.directory, `${id}.png`);
  }
}
