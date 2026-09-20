import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { RawFrameDecoder } from './raw-frame-decoder.mjs';
import { LatestFrameQueue } from './latest-frame-queue.mjs';
import { ProcessorClient } from './processor-client.mjs';

export function extractionArgs(settings, rtspUrl) {
  const { width, height, fps, transport } = settings;
  return [
    '-hide_banner', '-nostdin', '-nostats', '-loglevel', 'error',
    '-threads', '1', '-rtsp_transport', transport,
    '-use_wallclock_as_timestamps', '1', '-fflags', '+genpts+discardcorrupt',
    '-i', rtspUrl,
    '-map', '0:v:0', '-an', '-sn', '-dn', '-filter_threads', '1',
    // select drops frames; unlike fps/CFR it never inserts copies to fill gaps.
    '-vf', `setpts=PTS-STARTPTS,select='isnan(prev_selected_t)+gte(t-prev_selected_t,${1 / fps})',scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`,
    '-fps_mode', 'passthrough', '-c:v', 'rawvideo', '-pix_fmt', 'rgb24',
    '-threads', '1', '-f', 'rawvideo', 'pipe:1',
  ];
}

// Return only fixed codes; never expose FFmpeg lines containing URLs/secrets.
export function ffmpegDiagnostic(text) {
  if (/401|unauthorized|403 forbidden/i.test(text)) return 'RTSP_AUTH_FAILED';
  if (/461|unsupported transport/i.test(text)) return 'RTSP_TRANSPORT_UNSUPPORTED';
  if (/connection refused/i.test(text)) return 'RTSP_CONNECTION_REFUSED';
  if (/permission denied|operation not permitted/i.test(text)) return 'RTSP_ACCESS_DENIED';
  if (/timed out/i.test(text)) return 'RTSP_TIMEOUT';
  if (/no route to host|network is unreachable/i.test(text)) return 'RTSP_NETWORK_UNREACHABLE';
  if (/error while decoding|invalid data found/i.test(text)) return 'RTSP_DECODE_ERROR';
  return null;
}

export class FramePipeline {
  constructor(settings, { spawnProcess = spawn, processorFactory = timeout => new ProcessorClient(timeout, { settings }) } = {}) {
    this.settings = settings;
    this.spawnProcess = spawnProcess;
    this.processorFactory = processorFactory;
    this.state = 'IDLE';
    this.error = null;
    this.child = null;
    this.sessionId = null;
    this.latest = null;
    this.result = null;
    this.received = 0;
    this.processorState = 'IDLE';
    this.closed = Promise.resolve();
  }

  start(rtspUrl) {
    if (this.child || this.state === 'STOPPING') throw new Error('PIPELINE_BUSY');
    this.sessionId = randomUUID();
    this.state = 'CONNECTING';
    this.error = null;
    this.latest = null;
    this.result = null;
    this.received = 0;
    this.started = performance.now();
    this.queue = null;
    this.lastFrameTime = null;
    this.processorState = 'LOADING';
    this.diagnostic = null;
    this.receivedBytes = 0;
    this.processorError = null;
    try {
      this.processor = this.processorFactory(this.settings.processTimeoutMs);
    } catch {
      this.state = 'FAILED';
      this.processorState = 'FAILED';
      this.error = 'PROCESSOR_START_FAILED';
      return this.status();
    }
    const processor = this.processor;
    const sessionId = this.sessionId;
    Promise.resolve(processor.ready).then(() => {
      if (this.sessionId === sessionId && this.processorState === 'LOADING') {
        this.processorState = 'READY';
        this.queue?.resume();
      }
    }, () => {
      if (this.sessionId === sessionId && this.processorState === 'LOADING') {
        this.processorState = 'FAILED';
        this.processorError = 'PROCESSOR_LOAD_FAILED';
        this.queue?.close();
      }
    });
    this.queue = new LatestFrameQueue(
      frame => this.processor.process(frame),
      (result, frame) => { this.result = { ...result, sessionId: frame.sessionId, processedAt: new Date().toISOString() }; },
      () => { this.processorState = 'FAILED'; this.processorError ||= 'PROCESSOR_INFERENCE_FAILED'; void this.processor.close(); },
      Boolean(processor.ready),
    );
    const decoder = new RawFrameDecoder(this.settings.width * this.settings.height * 3, data => {
      if (!['CONNECTING', 'RUNNING'].includes(this.state)) return;
      this.lastFrameTime = performance.now();
      this.state = 'RUNNING';
      const frame = {
        data, sessionId: this.sessionId, cameraId: this.settings.cameraId,
        sequence: ++this.received, receivedAt: new Date().toISOString(),
        width: this.settings.width, height: this.settings.height, pixelFormat: 'rgb24',
      };
      this.latest = frame;
      this.queue.offer(frame);
    });
    let child;
    try {
      child = this.spawnProcess(this.settings.ffmpeg, extractionArgs(this.settings, rtspUrl), {
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      this.queue.close();
      void this.processor.close();
      this.state = 'FAILED';
      this.processorState = 'STOPPED';
      this.error = 'FFMPEG_START_FAILED';
      return this.status();
    }
    this.child = child;
    this.closed = new Promise(resolve => {
      child.once('close', async () => {
        clearInterval(this.watchdog);
        clearTimeout(this.killTimer);
        this.killTimer = null;
        this.queue.close();
        await this.processor.close();
        this.child = null;
        this.latest = null;
        this.processorState = 'STOPPED';
        if (this.state === 'STOPPING') this.state = 'STOPPED';
        else {
          this.state = 'FAILED';
          this.error ||= 'RTSP_ENDED';
        }
        resolve();
      });
    });
    child.stdout.on('data', data => { this.receivedBytes += data.length; decoder.push(data); });
    child.once('error', () => this.fail('FFMPEG_START_FAILED'));
    // Drain but never log raw FFmpeg diagnostics: these may contain RTSP secrets.
    let diagnostics = '';
    child.stderr.on('data', data => {
      diagnostics = (diagnostics + data.toString()).slice(-4096);
      this.diagnostic = ffmpegDiagnostic(diagnostics) || this.diagnostic;
    });
    this.watchdog = setInterval(() => {
      const elapsed = performance.now() - (this.lastFrameTime ?? this.started);
      const limit = this.lastFrameTime === null ? this.settings.connectTimeoutMs : this.settings.staleMs;
      if (elapsed > limit) this.fail(this.lastFrameTime === null ? 'NO_FRAMES_TIMEOUT' : 'FRAME_STALLED');
    }, 1000);
    return this.status();
  }

  fail(code) {
    if (this.state === 'STOPPING' || this.state === 'FAILED') return;
    this.state = 'FAILED';
    this.error = code;
    this.latest = null;
    this.queue?.close();
    this.terminateChild();
  }

  terminateChild() {
    // Only signal the FFmpeg child owned by this pipeline; never discover/kill HLS processes.
    const child = this.child;
    if (!child || this.killTimer) return;
    child.kill('SIGTERM');
    this.killTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, 3000);
  }

  async stop() {
    if (!this.child) {
      this.latest = null;
      this.state = 'STOPPED';
      this.processorState = 'STOPPED';
      return;
    }
    this.state = 'STOPPING';
    this.latest = null;
    this.queue.close();
    this.terminateChild();
    await this.closed;
  }

  latestFrame() {
    if (this.state !== 'RUNNING' || !this.latest || performance.now() - this.lastFrameTime > this.settings.staleMs) return null;
    return this.latest;
  }

  status() {
    return {
      state: this.state, error: this.error, cameraId: this.settings.cameraId, sessionId: this.sessionId,
      source: 'RTSP', transport: this.settings.transport,
      frameFormat: { pixelFormat: 'rgb24', width: this.settings.width, height: this.settings.height, fpsLimit: this.settings.fps },
      receivedFrames: this.received, receivedBytes: this.receivedBytes ?? 0,
      diagnostic: this.diagnostic ?? null,
      lastFrameAgeMs: this.lastFrameTime == null ? null : Math.round(performance.now() - this.lastFrameTime),
      lastFrameAt: this.latest?.receivedAt ?? null,
      processor: { name: 'yolo-fire-smoke', state: this.processorState,
        error: this.processorError ?? null, inferencePerformed: this.result?.inferencePerformed === true,
        processedFrames: this.queue?.processed ?? 0, droppedFrames: this.queue?.dropped ?? 0,
        busy: this.queue?.busy ?? false, pendingFrames: this.queue?.pending ? 1 : 0,
        lastResult: this.result },
    };
  }
}
