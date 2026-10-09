import { createApp } from './app.js';
import { config } from './config/index.js';

const app = createApp();

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
  console.log('\nShutting down FAVIS AI Backend...');
  server.close(() => {
    console.log('Backend server stopped.');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
