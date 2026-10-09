import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { cameraRouter } from './camera.routes.js';
import { alertRouter } from './alert.routes.js';
import { evidenceRouter } from './evidence.routes.js';
import { incidentRouter } from './incident.routes.js';
import { notificationRouter } from './notification.routes.js';
import { siteRouter } from './site.routes.js';

export const apiRouter = Router();

// Health Check
apiRouter.use(healthRouter);

// Camera Routes: /api/v1/cameras...
apiRouter.use(cameraRouter);

// Alert Routes: /api/v1/alerts...
apiRouter.use(alertRouter);

// Evidence Routes: /api/v1/evidence/:file
apiRouter.use(evidenceRouter);

// Incident Routes: /api/v1/incidents...
apiRouter.use(incidentRouter);

// Notification Routes: /api/v1/notifications...
apiRouter.use(notificationRouter);

// Site & Settings Routes: /api/v1/site, /api/v1/settings...
apiRouter.use(siteRouter);

