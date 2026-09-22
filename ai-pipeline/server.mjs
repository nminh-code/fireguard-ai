import express from 'express';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FramePipeline } from './pipeline.mjs';
import { loadEnvironment, readSettings, cameraUrl } from './config.mjs';

export function createApp({ settings, pipeline, ffmpegAvailable, getCameraUrl = cameraUrl }) {
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['127.0.0.1', 'localhost'].includes(req.hostname)) return res.sendStatus(403);
    const origin = req.get('Origin');
    const alertRead = req.method === 'GET' && ['/v1/alerts', '/v1/alerts/latest'].includes(req.path);
    // Read-only polling from the existing Vite frontend; control routes stay same-origin.
    if (alertRead) res.vary('Origin');
    if (origin && origin !== `http://${req.get('Host')}`) {
      if (!alertRead || !['http://localhost:3000', 'http://127.0.0.1:3000'].includes(origin)) return res.sendStatus(403);
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    if (req.method === 'POST' && !req.is('application/json')) return res.sendStatus(415);
    next();
  });
  app.use(express.json({ limit: '1kb', strict: true }));

  app.get('/health', (_req, res) => res.json({
    ok: true, service: 'ai-frame-pipeline', ffmpeg: ffmpegAvailable,
    autoStart: false, inferencePerformed: pipeline.status().processor.inferencePerformed,
  }));
  app.get('/v1/pipeline/status', (_req, res) => res.json(pipeline.status()));
  const alertContext = () => ({
    cameraId: settings.cameraId, sessionId: pipeline.sessionId, pipelineState: pipeline.state,
    ...pipeline.alerts.status(),
  });
  app.get('/v1/alerts/latest', (_req, res) => res.json({ ...alertContext(), alert: pipeline.alerts.latest() }));
  app.get('/v1/alerts', (req, res) => {
    const limit = req.query.limit === undefined ? pipeline.alerts.capacity : Number(req.query.limit);
    if (Object.keys(req.query).some(key => key !== 'limit') ||
        (req.query.limit !== undefined && (typeof req.query.limit !== 'string' || !/^[1-9]\d*$/.test(req.query.limit))) ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > pipeline.alerts.capacity) {
      return res.status(400).json({ error: 'INVALID_ALERT_QUERY', maxLimit: pipeline.alerts.capacity });
    }
    res.json({ ...alertContext(), alerts: pipeline.alerts.list(limit) });
  });
  app.get('/v1/evidence/:file', (req, res) => {
    const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.png$/i.exec(req.params.file);
    if (!match) return res.status(404).json({ error: 'EVIDENCE_NOT_FOUND' });
    const alert = pipeline.alerts.list().find(item => item.id === match[1] && item.evidenceUrl);
    const file = alert && pipeline.alerts.evidenceStore?.pathFor(alert.id);
    if (!file) return res.status(404).json({ error: 'EVIDENCE_NOT_FOUND' });
    res.type('png').sendFile(file, error => {
      if (error && !res.headersSent) res.status(404).json({ error: 'EVIDENCE_NOT_FOUND' });
    });
  });
  app.post('/v1/pipeline/start', (_req, res) => {
    if (!ffmpegAvailable) return res.status(503).json({ error: 'FFMPEG_UNAVAILABLE', message: 'Set AI_FFMPEG_PATH and restart this service.' });
    if (['CONNECTING', 'RUNNING'].includes(pipeline.state)) return res.json(pipeline.status());
    if (pipeline.child || pipeline.state === 'STOPPING') return res.status(409).json({ error: 'PIPELINE_STOPPING' });
    let url;
    try { url = getCameraUrl(); }
    catch {
      return res.status(400).json({ error: 'CAMERA_CONFIG_INVALID', message: 'Check AI_RTSP_URL (/onvif2), AI_CAMERA_USERNAME and AI_CAMERA_PASSWORD in .env.ai.local.' });
    }
    try {
      const status = pipeline.start(url);
      res.status(status.state === 'FAILED' ? 503 : 202).json(status);
    } catch {
      res.status(503).json({ error: 'PIPELINE_START_FAILED' });
    }
  });
  app.post('/v1/pipeline/stop', async (_req, res) => {
    try { await pipeline.stop(); res.json(pipeline.status()); }
    catch { res.status(503).json({ error: 'PIPELINE_STOP_FAILED' }); }
  });
  app.get('/v1/frames/latest', (_req, res) => {
    const frame = pipeline.latestFrame();
    if (!frame) return res.status(503).json({ error: 'NO_FRESH_FRAME' });
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(frame.data.length),
      'X-Frame-Format': frame.pixelFormat,
      'X-Frame-Width': String(frame.width),
      'X-Frame-Height': String(frame.height),
      'X-Frame-Sequence': String(frame.sequence),
      'X-Frame-Received-At': frame.receivedAt,
      'X-Frame-Session-Id': frame.sessionId,
    });
    res.end(frame.data);
  });
  // Never echo request bodies or stack traces (including configuration secrets).
  app.use((_err, _req, res, _next) => res.status(400).json({ error: 'INVALID_REQUEST' }));
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadEnvironment();
  let settings;
  try { settings = readSettings(); }
  catch {
    console.error('Invalid AI frame settings. Check .env.ai.local and ai-pipeline/README.md.');
    process.exit(1);
  }
  const ffmpegAvailable = spawnSync(settings.ffmpeg, ['-version'], {
    windowsHide: true, timeout: 5000, stdio: 'ignore',
  }).status === 0;
  const pipeline = new FramePipeline(settings);
  const server = createApp({ settings, pipeline, ffmpegAvailable }).listen(settings.port, '127.0.0.1', () => {
    console.log(`AI frame API: http://127.0.0.1:${settings.port} (idle; explicit start required)`);
  });
  server.on('error', () => {
    console.error('Cannot bind AI frame API. Check AI_FRAME_PORT.');
    process.exitCode = 1;
  });
  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    server.close();
    await pipeline.stop();
    server.closeAllConnections();
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
