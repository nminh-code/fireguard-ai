// Test process serving the real AI API from persisted test alerts; never a runtime input route.
import path from 'node:path';
import { FramePipeline } from '../pipeline.mjs';
import { readSettings } from '../config.mjs';
import { createApp } from '../server.mjs';
const settings = { ...readSettings({ AI_CAMERA_ID: 'test-camera', AI_FRAME_WIDTH: '32', AI_FRAME_HEIGHT: '32' }),
  evidenceDirectory: process.env.FAVIS_TEST_AI_DIR, alertJournalPath: path.join(process.env.FAVIS_TEST_AI_DIR, 'alerts.json') };
const pipeline = new FramePipeline(settings);
const server = createApp({ settings, pipeline, ffmpegAvailable: true }).listen(Number(process.env.FAVIS_TEST_AI_PORT), '127.0.0.1');
process.on('SIGTERM', () => server.close(() => process.exit(0)));
