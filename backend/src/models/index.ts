export * from './camera.model.js';
export * from './alert.model.js';
export * from './incident.model.js';

export interface HealthStatus {
  status: 'UP' | 'DOWN';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  version: string;
  services: {
    videoBridge: { url: string; reachable: boolean | null };
    aiPipeline: { url: string; reachable: boolean | null };
  };
}
