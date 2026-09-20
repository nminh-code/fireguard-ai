import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = fileURLToPath(new URL('../', import.meta.url));

export function loadEnvironment() {
  dotenv.config({ path: path.join(root, '.env.ai.local'), quiet: true });
}

function numberSetting(env, key, fallback, min, max, integer = true) {
  const value = Number(env[key] || fallback);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`Invalid ${key}; expected ${min}..${max}.`);
  }
  return value;
}

export function readSettings(env = process.env) {
  const transport = env.AI_RTSP_TRANSPORT || 'udp';
  if (!['udp', 'tcp'].includes(transport)) throw new Error('Invalid AI_RTSP_TRANSPORT.');
  const cameraId = env.AI_CAMERA_ID || 'camera-onvif2';
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(cameraId)) throw new Error('Invalid AI_CAMERA_ID.');
  return Object.freeze({
    port: numberSetting(env, 'AI_FRAME_PORT', 8790, 1024, 65535),
    cameraId,
    ffmpeg: env.AI_FFMPEG_PATH || env.FFMPEG_PATH || 'ffmpeg',
    transport,
    fps: numberSetting(env, 'AI_FRAME_FPS', 1, 0.2, 5, false),
    width: numberSetting(env, 'AI_FRAME_WIDTH', 640, 32, 640),
    height: numberSetting(env, 'AI_FRAME_HEIGHT', 720, 32, 720),
    staleMs: numberSetting(env, 'AI_FRAME_STALE_MS', 15000, 10000, 60000),
    connectTimeoutMs: numberSetting(env, 'AI_CONNECT_TIMEOUT_MS', 25000, 10000, 60000),
    processTimeoutMs: numberSetting(env, 'AI_PROCESS_TIMEOUT_MS', 30000, 1000, 120000),
    modelLoadTimeoutMs: numberSetting(env, 'AI_MODEL_LOAD_TIMEOUT_MS', 120000, 1000, 300000),
    python: env.AI_PYTHON_PATH || 'py',
    model: path.resolve(root, env.AI_MODEL_PATH || 'models/best.pt'),
    confidence: numberSetting(env, 'AI_CONFIDENCE', 0.5, 0, 1, false),
  });
}

// Called only by the backend on an explicit start request. Never serialize this URL.
export function cameraUrl(env = process.env) {
  let url;
  try { url = new URL(env.AI_RTSP_URL); }
  catch { throw new Error('Set AI_RTSP_URL in .env.ai.local.'); }
  if (url.protocol !== 'rtsp:' || url.pathname !== '/onvif2' || !url.hostname || url.hash) {
    throw new Error('AI_RTSP_URL must be an RTSP URL with the /onvif2 path.');
  }
  if (url.username || url.password) {
    throw new Error('Use AI_CAMERA_USERNAME and AI_CAMERA_PASSWORD instead of credentials in the URL.');
  }
  url.username = encodeURIComponent(env.AI_CAMERA_USERNAME || '');
  url.password = encodeURIComponent(env.AI_CAMERA_PASSWORD || '');
  return url.toString();
}
