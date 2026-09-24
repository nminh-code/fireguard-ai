import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

// One store per camera pipeline. Alert publication may be delayed, but frame processing is never blocked.
export class AlertStore {
  constructor({
    cameraId, cooldownMs = 30000, delayMs = 3000, capacity = 100,
    now = () => performance.now(), schedule = (callback, delay) => setTimeout(callback, delay), evidenceStore = null,
  }) {
    this.cameraId = cameraId;
    this.cooldownMs = cooldownMs;
    this.delayMs = delayMs;
    this.capacity = capacity;
    this.now = now;
    this.schedule = schedule;
    this.evidenceStore = evidenceStore;
    this.events = [];
    this.lastEmitted = new Map(); // At most two entries: fire and smoke.
    this.totalCreated = 0;
    this.beginSession(null);
  }

  beginSession(sessionId) {
    this.sessionId = sessionId;
    this.lastSequence = 0;
    // Retain history and cooldown across stop/start to avoid reconnect spam.
  }

  record(result, frame) {
    if (!this.sessionId || frame.sessionId !== this.sessionId || frame.cameraId !== this.cameraId ||
        !Number.isSafeInteger(frame.sequence) || frame.sequence <= this.lastSequence ||
        typeof frame.receivedAt !== 'string' || !Number.isFinite(Date.parse(frame.receivedAt)) ||
        result?.processor !== 'yolo-fire-smoke' || result.inferencePerformed !== true ||
        result.sequence !== frame.sequence || !Array.isArray(result.detections)) return;
    this.lastSequence = frame.sequence;
    const strongest = new Map();
    const validDetections = [];
    for (const detection of result.detections) {
      if (!detection || !['fire', 'smoke'].includes(detection.class) ||
          !Number.isFinite(detection.confidence) || detection.confidence < 0.5 || detection.confidence > 1 ||
          !Array.isArray(detection.box) || detection.box.length !== 4 || !detection.box.every(Number.isFinite)) continue;
      const [x1, y1, x2, y2] = detection.box;
      if (x1 < 0 || y1 < 0 || x2 <= x1 || y2 <= y1 || x2 > frame.width || y2 > frame.height) continue;
      validDetections.push(detection);
      if (!strongest.has(detection.class) || detection.confidence > strongest.get(detection.class).confidence) {
        strongest.set(detection.class, detection);
      }
    }
    const now = this.now(); // Monotonic time; camera/wall-clock changes do not bypass cooldown.
    for (const detection of strongest.values()) {
      const previous = this.lastEmitted.get(detection.class);
      if (previous !== undefined && now - previous < this.cooldownMs) continue;
      const id = randomUUID();
      let evidenceUrl = null;
      let preparedEvidence = null;
      try {
        preparedEvidence = this.evidenceStore?.prepare(id, frame, validDetections) ?? null;
        evidenceUrl = preparedEvidence?.url ?? null;
      } catch { /* Keep alerting if evidence encoding fails. */ }
      const event = Object.freeze({
        id, cameraId: frame.cameraId, sessionId: frame.sessionId,
        class: detection.class, confidence: detection.confidence,
        box: Object.freeze([...detection.box]), boxFormat: 'xyxy',
        timestamp: frame.receivedAt, sequence: frame.sequence,
        width: frame.width, height: frame.height, evidenceUrl,
      });
      this.lastEmitted.set(detection.class, now);
      if (this.delayMs === 0) this.publish(event, preparedEvidence);
      else this.schedule(() => this.publish(event, preparedEvidence), this.delayMs)?.unref?.();
    }
  }

  publish(event, preparedEvidence = null) {
    let publishedEvent = event;
    try { preparedEvidence?.commit(); }
    catch { publishedEvent = Object.freeze({ ...event, evidenceUrl: null }); }
    this.events.push(publishedEvent);
    if (this.events.length > this.capacity) {
      const removed = this.events.shift();
      try { this.evidenceStore?.delete(removed.id); } catch { /* Retention cleanup is best effort. */ }
    }
    this.totalCreated++;
  }

  latest() { return this.events.at(-1) ?? null; }

  list(limit = this.capacity) { return this.events.slice(-limit).reverse(); }

  status() {
    return {
      confidenceThreshold: 0.5, cooldownMs: this.cooldownMs, delayMs: this.delayMs, capacity: this.capacity,
      retained: this.events.length, totalCreated: this.totalCreated, latestId: this.latest()?.id ?? null,
    };
  }
}
