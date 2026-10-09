export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'WARNING' | 'FIRE';

export interface Camera {
  id: string;
  code: string;
  name: string;
  zoneId: string;
  location: string;
  streamUrl: string;
  ipAddress: string;
  model: string;
  resolution: string;
  fps: number;
  status: CameraStatus;
  aiStatus: 'AI_MONITORING' | 'FIRE_DETECTED' | 'IDLE' | 'OFFLINE';
  lastSeen: string;
  lastUpdate: string;
  uptime: string;
  mapCoords: {
    x: number;
    y: number;
  };
  previewSnapshotUrl?: string;
  fireConfidence?: number;
  smokeConfidence?: number;
}

export type CameraBrand = 'Hikvision' | 'Dahua' | 'Ezviz' | 'Imou' | 'Other';
export type CameraProtocol = 'RTSP' | 'ONVIF' | 'HTTP' | 'HTTPS' | 'Other';
export type CameraConnectionStatus =
  | 'NOT_CONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'FAILED'
  | 'DISCONNECTED';

export interface CameraConnectionConfig {
  id: string;
  name: string;
  brand: CameraBrand;
  model?: string;
  ip: string;
  port?: number | string;
  protocol: CameraProtocol;
  username?: string;
  password?: string;
  streamUrl?: string;
  apiUrl?: string;
}

export interface CameraConnectionResult {
  cameraId: string;
  status: 'CONNECTED' | 'FAILED' | 'NOT_CONNECTED';
  streamStatus?: 'AVAILABLE' | 'UNAVAILABLE';
  apiStatus?: 'AVAILABLE' | 'UNAVAILABLE';
  lastChecked?: string;
  errorMessage?: string;
  latencyMs?: number;
  playbackUrl?: string;
  webrtcUrl?: string;
  details?: Record<string, unknown>;
}
