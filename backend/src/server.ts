import { createApp } from './app.js';
import { config } from './config/index.js';
import { incidentService } from './services/incident.service.js';

const app = createApp();
let ingestionTimer: ReturnType<typeof setTimeout>;
let stopping = false;
async function ingestAlerts() {
  try { await incidentService.syncWithRealAlerts(); }
  catch (error) { console.error('[Alert ingestion] Persistence failed; will retry.', error); }
  finally { if (!stopping) ingestionTimer = setTimeout(ingestAlerts, 1000); }
}
void ingestAlerts();

const server = app.listen(config.port, config.host, () => {
  console.log(`===================================================`);
  console.log(`FAVIS AI Backend Server running on http://${config.host}:${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Health Check: http://localhost:${config.port}/health`);
  console.log(`API Base:     http://localhost:${config.port}/api/v1`);
  console.log(`===================================================`);
});

// Graceful shutdown
function shutdown() {
  stopping = true;
  clearTimeout(ingestionTimer);
  console.log('\nShutting down FAVIS AI Backend...');
  server.close(() => {
    console.log('Backend server stopped.');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
