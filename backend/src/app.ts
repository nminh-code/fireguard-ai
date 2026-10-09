import express from 'express';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';
import { getHealth } from './controllers/healthController.js';

export function createApp() {
  const app = express();

  // Basic security settings
  app.disable('x-powered-by');

  // Middleware
  app.use(corsMiddleware);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Root & Health check endpoints
  app.get('/health', getHealth);
  app.get('/', (_req, res) => {
    res.json({
      name: 'FAVIS AI Backend API',
      status: 'OPERATIONAL',
      version: '1.0.0',
      healthUrl: '/health',
      apiUrl: '/api/v1',
    });
  });

  // API v1 prefix
  app.use('/api/v1', apiRouter);

  // Legacy route alias for evidence files
  app.use('/v1', apiRouter);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found on FAVIS AI Backend',
      },
    });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}
