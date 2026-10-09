import { Request, Response } from 'express';
import { config } from '../config/index.js';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const uptime = process.uptime();
  
  // Basic health response
  res.status(200).json({
    status: 'UP',
    service: 'favis-ai-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(uptime),
    environment: config.nodeEnv,
    services: {
      videoBridge: {
        url: config.videoBridgeUrl,
      },
      aiPipeline: {
        url: config.aiServiceUrl,
      },
    },
  });
}
