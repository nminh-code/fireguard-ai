import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// stdout is a JSON-lines protocol; all library output stays on drained stderr.
export const pythonScript = `
import sys, json, os
protocol = sys.stdout
sys.stdout = sys.stderr

def emit(value):
    protocol.write(json.dumps(value) + "\\n")
    protocol.flush()

emit({"type": "python", "pid": os.getpid()})
try:
    import numpy as np
    from ultralytics import YOLO
    model = YOLO(sys.argv[1])
    names = {int(k): str(v).strip().lower() for k, v in model.names.items()}
    if not {"fire", "smoke"}.issubset(set(names.values())):
        raise ValueError("MODEL_CLASSES")
    confidence = float(sys.argv[2])
    # Warm up before READY; first inference includes predictor initialization.
    model.predict(source=np.zeros((64, 64, 3), dtype=np.uint8), conf=confidence, verbose=False, save=False)
    emit({"type": "ready"})
except Exception:
    emit({"type": "error", "error": "YOLO_LOAD_FAILED"})
    sys.exit(1)

while True:
    header = sys.stdin.buffer.readline()
    if not header:
        break
    try:
        meta = json.loads(header)
        width, height = int(meta["width"]), int(meta["height"])
        size = width * height * 3
        raw = sys.stdin.buffer.read(size)
        if len(raw) != size:
            break
        rgb = np.frombuffer(raw, dtype=np.uint8).reshape(height, width, 3)
        # Ultralytics ndarray input is BGR, while the frame API is RGB24.
        bgr = np.ascontiguousarray(rgb[:, :, ::-1])
        result = model.predict(source=bgr, conf=confidence, verbose=False, save=False)[0]
        detections = []
        for box in result.boxes:
            name = names[int(box.cls[0])]
            if name not in ("fire", "smoke"):
                continue
            detections.append({
                "class": name,
                "confidence": float(box.conf[0]),
                "box": [float(v) for v in box.xyxy[0].tolist()],
                "sequence": meta["sequence"],
                "timestamp": meta["timestamp"]
            })
        emit({"type": "result", "ok": True, "sequence": meta["sequence"], "detections": detections})
    except Exception:
        emit({"type": "result", "ok": False})
`;

export class YoloProcessor {
  constructor({ python = 'py', model = fileURLToPath(new URL('../../models/best.pt', import.meta.url)), confidence = 0.5 } = {}, { spawnProcess = spawn, onSpawn = () => {} } = {}) {
    this.options = { python, model, confidence };
    this.spawnProcess = spawnProcess;
    this.onSpawn = onSpawn;
    this.pending = null;
    this.closed = false;
  }

  ensureYolo() {
    if (this.closed) return Promise.reject(new Error('YOLO_CLOSED'));
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    const { python, model, confidence } = this.options;
    try {
      const child = this.child = this.spawnProcess(python, ['-u', '-c', pythonScript, model, String(confidence)], {
        stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
      });
      this.onSpawn(child.pid);
      this.exited = new Promise(resolve => child.once('close', resolve));
      let buffer = '';
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', data => {
        buffer += data;
        if (buffer.length > 1024 * 1024) { this.fail('YOLO_PROTOCOL_ERROR'); return; }
        let end;
        while ((end = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 1);
          try { this.message(JSON.parse(line)); }
          catch { this.fail('YOLO_PROTOCOL_ERROR'); }
        }
      });
      child.stderr.resume();
      child.stdin.on('error', () => this.fail('YOLO_PROCESS_FAILED'));
      child.on('error', () => this.fail('YOLO_START_FAILED'));
      child.once('close', () => {
        this.fail('YOLO_PROCESS_EXITED');
        this.onSpawn(null);
      });
    } catch { this.fail('YOLO_START_FAILED'); }
    return this.ready;
  }

  message(message) {
    if (message.type === 'python' && Number.isSafeInteger(message.pid) && message.pid > 0) {
      // py.exe may be a launcher; own the actual Python PID as well.
      this.pythonPid = message.pid;
      this.onSpawn(message.pid);
      return;
    }
    if (message.type === 'ready') { this.resolveReady(); return; }
    if (message.type === 'error') { this.fail('YOLO_LOAD_FAILED'); return; }
    const pending = this.pending;
    if (message.type !== 'result' || !pending) throw new Error('YOLO_PROTOCOL_ERROR');
    this.pending = null;
    if (!message.ok || message.sequence !== pending.frame.sequence || !Array.isArray(message.detections)) {
      pending.reject(new Error('YOLO_INFERENCE_FAILED'));
      return;
    }
    const frame = pending.frame;
    pending.resolve({
      processor: 'yolo-fire-smoke', inferencePerformed: true,
      sequence: frame.sequence, timestamp: frame.receivedAt, receivedAt: frame.receivedAt,
      cameraId: frame.cameraId, width: frame.width, height: frame.height,
      boxFormat: 'xyxy', detections: message.detections,
    });
  }

  async inferFrame(frame) {
    if (frame.pixelFormat !== 'rgb24' || !Number.isSafeInteger(frame.width) || !Number.isSafeInteger(frame.height) ||
        frame.width < 1 || frame.height < 1 || frame.data.byteLength !== frame.width * frame.height * 3) {
      throw new Error('YOLO_INVALID_FRAME');
    }
    await this.ensureYolo();
    if (this.closed || this.pending) throw new Error('YOLO_UNAVAILABLE');
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject, frame };
      const header = JSON.stringify({ width: frame.width, height: frame.height, sequence: frame.sequence, timestamp: frame.receivedAt });
      this.child.stdin.write(header + '\n');
      this.child.stdin.write(Buffer.from(frame.data));
    });
  }

  fail(code) {
    this.rejectReady?.(new Error(code));
    this.pending?.reject(new Error(code));
    this.pending = null;
    this.closed = true;
    if (this.pythonPid) {
      try { process.kill(this.pythonPid, 'SIGKILL'); } catch { /* Already exited. */ }
      this.pythonPid = null;
    }
    if (this.child && this.child.exitCode === null && this.child.signalCode === null) this.child.kill();
  }

  async stopYolo() {
    this.fail('YOLO_STOPPED');
    if (!this.child) return;
    const timer = setTimeout(() => this.child.kill('SIGKILL'), 1000);
    try { await this.exited; } finally { clearTimeout(timer); }
  }
}
