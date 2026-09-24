import fs from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GLYPHS = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
  F: ['111', '100', '110', '100', '100'], I: ['111', '010', '010', '010', '111'],
  R: ['110', '101', '110', '101', '101'], E: ['111', '100', '110', '100', '111'],
  S: ['111', '100', '111', '001', '111'], M: ['10001', '11011', '10101', '10101', '10101'],
  O: ['111', '101', '101', '101', '111'], K: ['101', '101', '110', '101', '101'],
  '.': ['0', '0', '0', '0', '1'], '%': ['1001', '0010', '0100', '1000', '1001'], ' ': ['0', '0', '0', '0', '0'],
};

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

function setPixel(rgb, width, height, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = (y * width + x) * 3;
  rgb[offset] = color[0]; rgb[offset + 1] = color[1]; rgb[offset + 2] = color[2];
}

function fillRect(rgb, width, height, x, y, rectWidth, rectHeight, color) {
  for (let py = Math.max(0, y); py < Math.min(height, y + rectHeight); py++) {
    for (let px = Math.max(0, x); px < Math.min(width, x + rectWidth); px++) setPixel(rgb, width, height, px, py, color);
  }
}

function drawText(rgb, width, height, text, x, y, scale, color) {
  let cursor = x;
  for (const character of text) {
    const glyph = GLYPHS[character] ?? GLYPHS[' '];
    const glyphWidth = glyph[0].length;
    for (let row = 0; row < glyph.length; row++) {
      for (let column = 0; column < glyphWidth; column++) {
        if (glyph[row][column] === '1') fillRect(rgb, width, height, cursor + column * scale, y + row * scale, scale, scale, color);
      }
    }
    cursor += (glyphWidth + 1) * scale;
  }
}

function annotate(rgb, width, height, detections) {
  const scale = Math.max(1, Math.min(3, Math.floor(Math.min(width, height) / 240)));
  const thickness = Math.max(1, Math.min(3, Math.floor(Math.min(width, height) / 300)));
  for (const detection of detections) {
    const color = detection.class === 'fire' ? [255, 64, 32] : [0, 128, 255];
    const x1 = Math.max(0, Math.min(width - 1, Math.floor(detection.box[0])));
    const y1 = Math.max(0, Math.min(height - 1, Math.floor(detection.box[1])));
    const x2 = Math.max(x1, Math.min(width - 1, Math.ceil(detection.box[2]) - 1));
    const y2 = Math.max(y1, Math.min(height - 1, Math.ceil(detection.box[3]) - 1));
    fillRect(rgb, width, height, x1, y1, x2 - x1 + 1, thickness, color);
    fillRect(rgb, width, height, x1, y2 - thickness + 1, x2 - x1 + 1, thickness, color);
    fillRect(rgb, width, height, x1, y1, thickness, y2 - y1 + 1, color);
    fillRect(rgb, width, height, x2 - thickness + 1, y1, thickness, y2 - y1 + 1, color);
    const label = `${detection.class.toUpperCase()} ${(detection.confidence * 100).toFixed(1)}%`;
    const labelWidth = [...label].reduce((sum, character) => sum + ((GLYPHS[character] ?? GLYPHS[' '])[0].length + 1) * scale, 0) + 2 * scale;
    const labelHeight = 7 * scale;
    const labelX = Math.min(x1, Math.max(0, width - labelWidth));
    const labelY = y1 >= labelHeight ? y1 - labelHeight : y1;
    fillRect(rgb, width, height, labelX, labelY, labelWidth, labelHeight, color);
    drawText(rgb, width, height, label, labelX + scale, labelY + scale, scale, [255, 255, 255]);
  }
}

// Encode the RGB24 buffer already consumed by YOLO. No camera or stream is opened here.
export function encodeRgbPng(frame, detections = []) {
  const { data, width, height } = frame;
  if (!Buffer.isBuffer(data) || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || data.length !== width * height * 3) throw new Error('INVALID_EVIDENCE_FRAME');
  const rgb = Buffer.from(data);
  annotate(rgb, width, height, detections);
  const stride = width * 3;
  const scanlines = Buffer.allocUnsafe((stride + 1) * height);
  for (let row = 0; row < height; row++) {
    const output = row * (stride + 1);
    scanlines[output] = 0;
    rgb.copy(scanlines, output + 1, row * stride, (row + 1) * stride);
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

  prepare(id, frame, detections = []) {
    if (!UUID.test(id)) throw new Error('INVALID_EVIDENCE_ID');
    const png = encodeRgbPng(frame, detections);
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
