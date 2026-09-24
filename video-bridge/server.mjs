import express from 'express';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const app = express();
const bridgeDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(bridgeDir, '..', '.env.ai.local'), quiet: true });
dotenv.config({ path: path.join(bridgeDir, '..', '.env.local'), quiet: true });
dotenv.config({ path: path.join(bridgeDir, '..', '.env'), quiet: true });

function findFfmpeg() {
  const rawEnvPath = process.env.FFMPEG_PATH || process.env.AI_FFMPEG_PATH;
  if (rawEnvPath) {
    const cleanEnv = rawEnvPath.trim().replace(/^"+|"+$/g, '');
    if (cleanEnv && cleanEnv !== 'ffmpeg' && existsSync(cleanEnv)) return cleanEnv;
  }

  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const res = spawnSync(cmd, ['ffmpeg'], { windowsHide: true, shell: true });
    if (res.status === 0 && res.stdout) {
      const lines = res.stdout.toString().split(/\r?\n/);
      for (const line of lines) {
        const clean = line.trim().replace(/^"+|"+$/g, '');
        if (clean && existsSync(clean)) return clean;
      }
    }
  } catch {}

  const defaultWindows = 'C:\\env\\ffmpeg-master-latest-win64-gpl\\ffmpeg-master-latest-win64-gpl\\bin\\ffmpeg.exe';
  if (existsSync(defaultWindows)) return defaultWindows;

  return 'ffmpeg';
}

function findGo2rtc() {
  const localExe = path.join(bridgeDir, 'bin', 'go2rtc.exe');
  if (existsSync(localExe)) return localExe;
  const envPath = process.env.GO2RTC_PATH;
  if (envPath) {
    const clean = envPath.trim().replace(/^"+|"+$/g, '');
    if (clean && existsSync(clean)) return clean;
  }
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const res = spawnSync(cmd, ['go2rtc'], { windowsHide: true, shell: true });
    if (res.status === 0 && res.stdout) {
      const line = res.stdout.toString().split(/\r?\n/)[0].trim().replace(/^"+|"+$/g, '');
      if (line && existsSync(line)) return line;
    }
  } catch {}
  return null;
}

const port = Number(process.env.VIDEO_BRIDGE_PORT || 8787);
const streamsDir = path.join(bridgeDir, 'streams');
const sessions = new Map();
const requests = new Map();
const sourceRequests = new Map();
const ffmpeg = findFfmpeg();
const ffmpegAvailable = spawnSync(ffmpeg, ['-version'], { windowsHide: true }).status === 0;
const go2rtcExe = findGo2rtc();
let go2rtcChild = null;

function ensureGo2rtc() {
  if (!go2rtcExe || go2rtcChild) return;
  try {
    go2rtcChild = spawn(go2rtcExe, [], { cwd: bridgeDir, windowsHide: true, stdio: 'ignore' });
    go2rtcChild.once('exit', () => { go2rtcChild = null; });
  } catch {}
}

async function syncGo2rtcStream(cameraId, rtspUrl) {
  if (!go2rtcExe) return null;
  ensureGo2rtc();
  const apiUrl = `http://127.0.0.1:1984/api/streams?name=${encodeURIComponent(cameraId)}&src=${encodeURIComponent(rtspUrl)}`;
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(apiUrl, { method: 'PUT' });
      if (res.ok) return `ws://127.0.0.1:1984/api/ws?src=${encodeURIComponent(cameraId)}`;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return null;
}

const STALE_MS = 20000;
mkdirSync(streamsDir, { recursive: true });

app.disable('x-powered-by');
app.disable('etag');
app.use(express.json({ limit: '32kb' }));
// Serve one complete playlist snapshot, never a cached/ranged fragment.
// Fail explicitly if a stale or damaged playlist references missing files.
app.get('/streams/:streamId/index.m3u8', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (!/^[a-zA-Z0-9_-]+$/.test(req.params.streamId)) return res.sendStatus(400);
  const directory = path.join(streamsDir, req.params.streamId);
  try {
    const child = [...sessions.values()].find(item => item.streamId === req.params.streamId);
    if (!child || child.exitCode !== null || child.killed ||
        Date.now() - statSync(path.join(directory, 'index.m3u8')).mtimeMs > STALE_MS) {
      return res.status(410).end('Live session stopped or stalled. Test the camera again.');
    }
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

async function stopSession(id) {
  const child = sessions.get(id);
  if (child && child.exitCode === null && child.signalCode === null) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('FFmpeg cũ chưa dừng; hãy thử lại.')), 5000);
      child.once('close', () => { clearTimeout(timer); resolve(); });
      child.kill('SIGTERM');
    });
  }
  if (sessions.get(id) === child) sessions.delete(id);
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
        ready = playlist.startsWith('#EXTM3U') && segments.length >= 3 && segments.every(name =>
          /^segment_\d+\.ts$/.test(name) && statSync(path.join(outputDir, name)).size > 0);
      } catch { /* Playlist is not published yet; retry on the next tick. */ }
      if (child.exitCode === null && !child.killed && ready) {
        clearInterval(timer);
        resolve();
      } else if (child.exitCode !== null || child.killed || child.spawnFailed) {
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
  requests.set(id, streamId);
  let child;
  let sourceKey;
  try {
    if (!ffmpegAvailable) {
      throw new Error('Không tìm thấy FFmpeg trong PATH. Hãy cài FFmpeg rồi khởi động lại video bridge.');
    }
    const rtspUrl = buildRtspUrl(req.body || {});
    // Avoid multiple UDP readers from this bridge for the same camera path.
    const parsed = new URL(rtspUrl);
    sourceKey = `${parsed.host}${parsed.pathname}${parsed.search}`;
    sourceRequests.set(sourceKey, streamId);
    for (const [otherId, other] of sessions) {
      if (otherId === id || other.sourceKey === sourceKey) await stopSession(otherId);
    }
    if (requests.get(id) !== streamId || sourceRequests.get(sourceKey) !== streamId) {
      throw new Error('Đã có yêu cầu kiểm tra mới hơn.');
    }
    
    // Đăng ký luồng vào go2rtc trước để làm Proxy trung tâm
    let webrtcUrl = null;
    try {
      webrtcUrl = await syncGo2rtcStream(id, rtspUrl);
    } catch (e) {}
    
    // Nếu go2rtc chạy OK, FFmpeg sẽ lấy luồng từ go2rtc thay vì gọi ra camera
    const proxyRtspUrl = webrtcUrl ? `rtsp://127.0.0.1:8554/${id}` : rtspUrl;

    const fps = process.env.VIDEO_BRIDGE_FPS;
    const vfFilter = fps ? `setpts=PTS-STARTPTS,fps=${fps}` : 'setpts=PTS-STARTPTS';

    mkdirSync(outputDir, { recursive: true });
    child = spawn(ffmpeg, [
      '-hide_banner', '-nostdin', '-loglevel', 'warning', '-nostats', '-progress', 'pipe:1',
      '-rtsp_transport', 'tcp', '-buffer_size', '10240000', '-analyzeduration', '1000000',
      // Use receive time, not the camera's drifting/discontinuous RTP clock.
      '-use_wallclock_as_timestamps', '1', '-fflags', '+genpts+discardcorrupt',
      '-i', proxyRtspUrl,
      '-map', '0:v:0', '-an', '-vf', vfFilter, '-fps_mode', 'vfr',
      '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
      '-pix_fmt', 'yuv420p', '-g', '15', '-keyint_min', '15', '-sc_threshold', '0',
      '-force_key_frames', 'expr:gte(t,n_forced*1)',
      '-f', 'hls', '-hls_time', '1', '-hls_list_size', '5',
      // Keep an extra 120 seconds for clients fetching a previous playlist.
      // Publish completed segments atomically before advertising them.
      '-hls_delete_threshold', '60',
      '-hls_flags', 'delete_segments+temp_file+omit_endlist+independent_segments',
      '-hls_segment_filename', 'segment_%05d.ts',
      'index.m3u8',
    ], { cwd: outputDir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.streamId = streamId;
    child.sourceKey = sourceKey;
    child.startedAt = Date.now();
    child.metrics = {};
    sessions.set(id, child);
    // Only expose numeric progress; never store/log FFmpeg text containing credentials.
    let progress = '';
    child.stdout.on('data', data => {
      progress += data.toString();
      const lines = progress.split(/\r?\n/);
      progress = lines.pop().slice(-1024);
      for (const line of lines) {
        const [key, value] = line.split('=');
        if (['frame', 'out_time_us', 'dup_frames', 'drop_frames'].includes(key) && Number.isFinite(Number(value))) {
          child.metrics[key] = Number(value);
        }
      }
    });
    child.stderr.on('data', () => {});
    const watchdog = setInterval(() => {
      let updatedAt = child.startedAt;
      try { updatedAt = statSync(path.join(outputDir, 'index.m3u8')).mtimeMs; } catch {}
      if (Date.now() - updatedAt > STALE_MS) child.kill('SIGTERM');
    }, 2000);
    child.once('close', () => clearInterval(watchdog));
    child.once('exit', () => {
      if (sessions.get(id) === child) sessions.delete(id);
    });
    child.once('error', () => { child.spawnFailed = true; });

    await waitForHls(outputDir, child);
    if (sessions.get(id) !== child || requests.get(id) !== streamId) {
      throw new Error('Phiên camera đã được thay thế.');
    }
    res.json({
      cameraId: id,
      streamStatus: 'AVAILABLE',
      apiStatus: 'AVAILABLE',
      playbackUrl: `/streams/${streamId}/index.m3u8`,
      webrtcUrl: webrtcUrl || null,
      latencyMs: Date.now() - started,
      transport: 'TCP',
      outputCodec: 'H.264',
    });
  } catch (error) {
    if (child && !child.killed) child.kill('SIGTERM');
    if (sessions.get(id) === child) sessions.delete(id);
    res.status(502).json({ error: error instanceof Error ? error.message : 'Không thể mở RTSP stream.' });
  } finally {
    if (requests.get(id) === streamId) requests.delete(id);
    if (sourceRequests.get(sourceKey) === streamId) sourceRequests.delete(sourceKey);
  }
});

app.post('/api/v1/cameras/:id/disconnect', async (req, res) => {
  const id = safeId(req.params.id);
  requests.delete(id);
  try { await stopSession(id); res.json({ success: true }); }
  catch { res.status(503).json({ error: 'Không thể dừng FFmpeg.' }); }
});

app.get('/api/v1/cameras/:id/status', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const child = sessions.get(safeId(req.params.id));
  if (!child) return res.json({ status: 'NOT_CONNECTED' });
  let sequence = null;
  let lastSegment = null;
  let playlistAgeMs = null;
  try {
    const file = path.join(streamsDir, child.streamId, 'index.m3u8');
    const playlist = readFileSync(file, 'utf8');
    sequence = Number(playlist.match(/MEDIA-SEQUENCE:(\d+)/)?.[1]);
    lastSegment = playlist.match(/^segment_\d+\.ts$/gm)?.at(-1);
    playlistAgeMs = Date.now() - statSync(file).mtimeMs;
  } catch {}
  res.json({ status: playlistAgeMs !== null && playlistAgeMs < STALE_MS && !child.killed ? 'CONNECTED' : 'CONNECTING',
    streamId: child.streamId, sequence, lastSegment, playlistAgeMs,
    elapsedSeconds: (Date.now() - child.startedAt) / 1000, ...child.metrics });
});

app.post('/api/v1/cameras', (req, res) => {
  try {
    const config = req.body;
    if (config && config.id && config.ip && config.password) {
      const rtspUrl = buildRtspUrl(config);
      
      // Cập nhật cấu hình vào go2rtc để tự động proxy camera này vào lần khởi động sau
      const yamlPath = path.join(bridgeDir, 'go2rtc.yaml');
      const yamlContent = `streams:\n  ${config.id}: "${rtspUrl}"\n`;
      writeFileSync(yamlPath, yamlContent, 'utf8');
      
      // Tự động trỏ AI Pipeline sang camera mới (thông qua luồng ảo)
      const envPath = path.join(bridgeDir, '../.env.ai.local');
      if (existsSync(envPath)) {
        let envContent = readFileSync(envPath, 'utf8');
        envContent = envContent.replace(/^AI_CAMERA_ID=.*$/m, `AI_CAMERA_ID=${config.id}`);
        envContent = envContent.replace(/^AI_RTSP_URL=.*$/m, `AI_RTSP_URL=rtsp://127.0.0.1:8554/${config.id}`);
        envContent = envContent.replace(/^AI_CAMERA_USERNAME=.*$/m, `AI_CAMERA_USERNAME=`);
        envContent = envContent.replace(/^AI_CAMERA_PASSWORD=.*$/m, `AI_CAMERA_PASSWORD=`);
        writeFileSync(envPath, envContent, 'utf8');
      }
    }
  } catch (e) {
    console.error('Lỗi khi lưu cấu hình backend:', e);
  }
  res.json({ success: true });
});
app.get('/health', (_req, res) => res.json({ ok: true, ffmpeg: ffmpegAvailable }));

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Video bridge listening on http://127.0.0.1:${port}`);
});

async function shutdown() {
  await Promise.allSettled([...sessions.keys()].map(stopSession));
  if (go2rtcChild && go2rtcChild.exitCode === null) {
    try { go2rtcChild.kill('SIGTERM'); } catch {}
  }
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
