import express from 'express';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.VIDEO_BRIDGE_PORT || 8787);
const bridgeDir = path.dirname(fileURLToPath(import.meta.url));
const streamsDir = path.join(bridgeDir, 'streams');
const sessions = new Map();
const ffmpegAvailable = spawnSync('ffmpeg', ['-version'], { windowsHide: true }).status === 0;
mkdirSync(streamsDir, { recursive: true });

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
// Serve one complete playlist snapshot, never a cached/ranged fragment.
// Fail explicitly if a stale or damaged playlist references missing files.
app.get('/streams/:streamId/index.m3u8', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (!/^[a-zA-Z0-9_-]+$/.test(req.params.streamId)) return res.sendStatus(400);
  const directory = path.join(streamsDir, req.params.streamId);
  try {
    const playlist = readFileSync(path.join(directory, 'index.m3u8'), 'utf8');
    const segments = playlist.split(/\r?\n/).map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
    if (!playlist.startsWith('#EXTM3U') || !segments.length || !segments.every(name =>
      /^segment_\d+\.ts$/.test(name) && statSync(path.join(directory, name)).size > 0)) {
      throw new Error('Playlist not ready');
    }
    res.status(200).type('application/vnd.apple.mpegurl').end(playlist);
  } catch {
    res.setHeader('Retry-After', '1');
    res.status(503).end('HLS playlist is not ready or its segments are unavailable.');
  }
});
app.use('/streams', express.static(streamsDir, {
  etag: false,
  lastModified: false,
  acceptRanges: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
  },
}));

function safeId(value) {
  return String(value || 'camera').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

function stopSession(id) {
  const child = sessions.get(id);
  if (child && !child.killed) child.kill('SIGTERM');
  sessions.delete(id);
}

function buildRtspUrl(config) {
  if (config.protocol !== 'RTSP') throw new Error('Video bridge hiện chỉ hỗ trợ giao thức RTSP.');
  const portValue = Number(config.port || 554);
  if (!config.ip || !Number.isInteger(portValue) || portValue < 1 || portValue > 65535) {
    throw new Error('IP Address hoặc Port không hợp lệ.');
  }

  let url;
  if (config.streamUrl) {
    url = new URL(config.streamUrl);
    if (url.protocol !== 'rtsp:') throw new Error('Stream URL phải bắt đầu bằng rtsp://');
  } else {
    url = new URL(`rtsp://${config.ip}:${portValue}/onvif2`);
  }
  if (config.username) url.username = config.username;
  if (config.password) url.password = config.password;
  return url.toString();
}

function waitForHls(outputDir, child, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      let ready = false;
      try {
        const playlist = readFileSync(path.join(outputDir, 'index.m3u8'), 'utf8');
        const segments = playlist.split(/\r?\n/).map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));
        ready = playlist.startsWith('#EXTM3U') && segments.length > 0 && segments.every(name =>
          /^segment_\d+\.ts$/.test(name) && statSync(path.join(outputDir, name)).size > 0);
      } catch { /* Playlist is not published yet; retry on the next tick. */ }
      if (child.exitCode === null && !child.killed && ready) {
        clearInterval(timer);
        resolve();
      } else if (child.exitCode !== null || child.killed) {
        clearInterval(timer);
        reject(new Error('FFmpeg dừng trước khi nhận được video. Kiểm tra URL, tài khoản, codec và kết nối mạng.'));
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error('Hết thời gian chờ RTSP (25 giây). Camera không trả về khung hình hợp lệ.'));
      }
    }, 250);
  });
}

app.post('/api/v1/cameras/test-connection', async (req, res) => {
  const started = Date.now();
  const id = safeId(req.body?.id);
  // Never reuse a live directory: an older FFmpeg process or browser request
  // must not collide with the next test for the same camera.
  const streamId = randomUUID();
  const outputDir = path.join(streamsDir, streamId);
  let child;
  try {
    if (!ffmpegAvailable) {
      throw new Error('Không tìm thấy FFmpeg trong PATH. Hãy cài FFmpeg rồi khởi động lại video bridge.');
    }
    const rtspUrl = buildRtspUrl(req.body || {});
    stopSession(id);
    mkdirSync(outputDir, { recursive: true });

    child = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-rtsp_transport', 'udp',
      '-i', rtspUrl,
      '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
      '-pix_fmt', 'yuv420p', '-g', '30', '-keyint_min', '30', '-sc_threshold', '0',
      '-f', 'hls', '-hls_time', '2', '-hls_list_size', '10',
      // Keep an extra 120 seconds for clients fetching a previous playlist.
      // Publish completed segments atomically before advertising them.
      '-hls_delete_threshold', '60',
      '-hls_flags', 'delete_segments+temp_file+omit_endlist+independent_segments',
      '-hls_segment_filename', 'segment_%05d.ts',
      'index.m3u8',
    ], { cwd: outputDir, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    sessions.set(id, child);
    child.stderr.on('data', () => {}); // Consume output; never log a URL containing credentials.
    child.once('exit', () => {
      if (sessions.get(id) === child) sessions.delete(id);
    });
    child.once('error', () => {});

    await waitForHls(outputDir, child);
    res.json({
      cameraId: id,
      streamStatus: 'AVAILABLE',
      apiStatus: 'AVAILABLE',
      playbackUrl: `/streams/${streamId}/index.m3u8`,
      latencyMs: Date.now() - started,
      transport: 'UDP',
      outputCodec: 'H.264',
    });
  } catch (error) {
    if (child && !child.killed) child.kill('SIGTERM');
    if (sessions.get(id) === child) sessions.delete(id);
    res.status(502).json({ error: error instanceof Error ? error.message : 'Không thể mở RTSP stream.' });
  }
});

app.post('/api/v1/cameras/:id/disconnect', (req, res) => {
  stopSession(safeId(req.params.id));
  res.json({ success: true });
});

app.post('/api/v1/cameras', (_req, res) => res.json({ success: true }));
app.get('/health', (_req, res) => res.json({ ok: true, ffmpeg: ffmpegAvailable }));

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Video bridge listening on http://127.0.0.1:${port}`);
});

function shutdown() {
  for (const id of sessions.keys()) stopSession(id);
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
