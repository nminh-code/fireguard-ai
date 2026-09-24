import { spawn } from 'node:child_process';
import { readFileSync, statSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';

export const STALE_MS = 10000;
export const MAX_RECONNECTS = 5;
export const RECONNECT_DELAY_MS = 2000;

export function readHls(directory) {
  const file = path.join(directory, 'index.m3u8');
  const playlist = readFileSync(file, 'utf8');
  const segments = playlist.split(/\r?\n/).map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  if (!playlist.startsWith('#EXTM3U') || !segments.length || !segments.every(name =>
    /^segment_\d+\.ts$/.test(name) && statSync(path.join(directory, name)).size > 0)) {
    throw new Error('HLS is not ready');
  }
  const lastSegment = segments.at(-1);
  const segment = statSync(path.join(directory, lastSegment));
  return { playlist, segments, lastSegment, updatedAt: segment.mtimeMs,
    signature: `${lastSegment}:${segment.mtimeMs}:${segment.size}`,
    sequence: Number(playlist.match(/MEDIA-SEQUENCE:(\d+)/)?.[1]),
    playlistAgeMs: Date.now() - statSync(file).mtimeMs };
}

export function ffmpegArgs(rtspUrl, fps = process.env.VIDEO_BRIDGE_FPS) {
  const vfFilter = fps ? `setpts=PTS-STARTPTS,fps=${fps}` : 'setpts=PTS-STARTPTS';
  return [
    '-hide_banner', '-nostdin', '-loglevel', 'warning', '-nostats', '-progress', 'pipe:1',
    '-rtsp_transport', 'tcp', '-buffer_size', '10240000',
    '-use_wallclock_as_timestamps', '1', '-fflags', '+genpts+discardcorrupt',
    '-i', rtspUrl,
    '-map', '0:v:0', '-an', '-vf', vfFilter, '-fps_mode', 'vfr',
    '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
    '-pix_fmt', 'yuv420p', '-g', '15', '-keyint_min', '15', '-sc_threshold', '0',
    '-force_key_frames', 'expr:gte(t,n_forced*1)',
    '-f', 'hls', '-hls_time', '1', '-hls_list_size', '5',
    '-hls_delete_threshold', '60',
    // append_list preserves media sequence and inserts a discontinuity at restart.
    // The old process MUST be closed before another writer opens this directory.
    '-hls_flags', 'delete_segments+temp_file+omit_endlist+independent_segments+append_list',
    '-hls_segment_filename', 'segment_%05d.ts', 'index.m3u8',
  ];
}

export class BridgeSession {
  constructor({ ffmpeg, rtspUrl, outputDir, streamId, sourceKey,
    spawnProcess = spawn, staleMs = STALE_MS, delayMs = RECONNECT_DELAY_MS,
    maxReconnects = MAX_RECONNECTS, tickMs = 500, killMs = 3000 }) {
    Object.assign(this, { ffmpeg, rtspUrl, outputDir, streamId, sourceKey,
      spawnProcess, staleMs, delayMs, maxReconnects, tickMs, killMs });
    this.startedAt = Date.now();
    this.metrics = {};
    this.reconnects = 0;
    this.state = 'CONNECTING';
  }

  start() {
    if (this.stopped || this.failed || this.child && !this.closed) return;
    try {
      // Only incomplete atomic writes are removed; published media stays readable.
      for (const name of readdirSync(this.outputDir)) {
        if (/^(index\.m3u8|segment_\d+\.ts)\.tmp$/.test(name)) unlinkSync(path.join(this.outputDir, name));
      }
      try { this.baseline = readHls(this.outputDir).signature; } catch { this.baseline = null; }
      this.lastSignature = this.baseline;
      this.lastSegmentAt = Date.now();
      this.state = 'CONNECTING';
      this.metrics = {};
      const child = this.spawnProcess(this.ffmpeg, ffmpegArgs(this.rtspUrl), {
        cwd: this.outputDir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.child = child;
      this.closed = false;
      this.closePromise = new Promise(resolve => child.once('close', () => {
        this.closed = true;
        resolve();
        void this.recover();
      }));
      // Consume but never retain/log raw FFmpeg errors or the credentialed URL.
      child.stderr.on('data', () => {});
      child.once('error', () => { this.state = 'CONNECTING'; });
      child.once('exit', () => { this.state = 'CONNECTING'; });
      let progress = '';
      child.stdout.on('data', data => {
        progress += data.toString();
        const lines = progress.split(/\r?\n/);
        progress = lines.pop().slice(-1024);
        for (const line of lines) {
          const [key, value] = line.split('=');
          if (['frame', 'out_time_us', 'dup_frames', 'drop_frames'].includes(key) && Number.isFinite(Number(value))) {
            this.metrics[key] = Number(value);
          }
        }
      });
      this.watchdog = setInterval(() => {
        this.snapshot();
        if (Date.now() - this.lastSegmentAt >= this.staleMs) void this.recover();
      }, this.tickMs);
    } catch {
      void this.recover();
    }
  }

  snapshot() {
    let hls;
    try { hls = readHls(this.outputDir); } catch { /* Atomic publication may not exist yet. */ }
    if (hls && hls.signature !== this.lastSignature) {
      this.lastSignature = hls.signature;
      this.lastSegmentAt = hls.updatedAt;
    }
    const running = this.child && !this.closed && this.child.exitCode === null &&
      this.child.signalCode === null && !this.child.killed;
    this.state = this.stopped || this.failed ? 'NOT_CONNECTED' :
      running && !this.recovering && hls && hls.segments.length >= 3 &&
      hls.signature !== this.baseline && Date.now() - hls.updatedAt < this.staleMs
        ? 'CONNECTED' : 'CONNECTING';
    return { status: this.state, hls };
  }

  async terminate() {
    if (!this.child || this.closed) return;
    const child = this.child;
    // `killed` means a signal was sent, NOT that the process is gone.
    child.kill('SIGTERM');
    let timer;
    const closed = await Promise.race([
      this.closePromise.then(() => true),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), this.killMs); }),
    ]);
    clearTimeout(timer);
    if (closed) return;
    child.kill('SIGKILL');
    const forced = await Promise.race([
      this.closePromise.then(() => true),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), this.killMs); }),
    ]);
    clearTimeout(timer);
    if (!forced) throw new Error('FFmpeg has not closed; replacement is blocked.');
  }

  async recover() {
    if (this.stopped || this.failed || this.recovering) return;
    this.recovering = true;
    this.state = 'CONNECTING';
    clearInterval(this.watchdog);
    try {
      await this.terminate();
      if (this.stopped) return;
      if (this.reconnects >= this.maxReconnects) { this.failed = true; return; }
      this.reconnects += 1;
      await new Promise(resolve => {
        this.cancelDelay = resolve;
        this.retryTimer = setTimeout(resolve, this.delayMs);
      });
      this.cancelDelay = null;
      if (this.stopped) return;
      this.recovering = false;
      this.start();
    } catch {
      // Retain this session as an ownership fence if the old child cannot stop.
      this.failed = true;
    } finally {
      this.recovering = false;
    }
  }

  async waitReady(timeoutMs = 25000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (this.stopped || this.failed) throw new Error('Không thể nhận video RTSP hợp lệ.');
      if (this.snapshot().status === 'CONNECTED') return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Hết thời gian chờ RTSP (25 giây). Camera không trả về video hợp lệ.');
  }

  async stop() {
    this.stopped = true;
    this.state = 'NOT_CONNECTED';
    clearInterval(this.watchdog);
    clearTimeout(this.retryTimer);
    this.cancelDelay?.();
    await this.terminate();
    this.rtspUrl = '';
  }
}
