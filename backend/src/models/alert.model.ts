export interface MonitoringAlert {
  id: string;
  cameraId: string;
  sessionId: string;
  class: 'fire' | 'smoke';
  confidence: number;
  box: [number, number, number, number];
  boxFormat: 'xyxy';
  timestamp: string;
  sequence: number;
  width: number;
  height: number;
  evidenceUrl: string | null;
}

export type PipelineState = 'IDLE' | 'CONNECTING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'FAILED';

export interface AlertHistoryResponse {
  cameraId: string;
  sessionId: string | null;
  pipelineState: PipelineState;
  retained: number;
  totalCreated: number;
  capacity: number;
  alerts: MonitoringAlert[];
}

export interface LatestAlertResponse {
  cameraId: string;
  sessionId: string | null;
  pipelineState: PipelineState;
  alert: MonitoringAlert | null;
  retained?: number;
  totalCreated?: number;
  capacity?: number;
}
