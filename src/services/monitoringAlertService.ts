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
}

const API_BASE = 'http://127.0.0.1:8790/v1/alerts';
const PIPELINE_STATES = new Set<PipelineState>(['IDLE', 'CONNECTING', 'RUNNING', 'STOPPING', 'STOPPED', 'FAILED']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function parseAlert(value: unknown): MonitoringAlert {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.cameraId !== 'string' ||
      typeof value.sessionId !== 'string' || !['fire', 'smoke'].includes(String(value.class)) ||
      typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) ||
      value.confidence < 0.5 || value.confidence > 1 || value.boxFormat !== 'xyxy' ||
      !Array.isArray(value.box) || value.box.length !== 4 || !value.box.every(Number.isFinite) ||
      typeof value.timestamp !== 'string' || !Number.isFinite(Date.parse(value.timestamp)) ||
      !Number.isSafeInteger(value.sequence) || !Number.isSafeInteger(value.width) ||
      !Number.isSafeInteger(value.height)) {
    throw new Error('INVALID_ALERT_RESPONSE');
  }
  return value as unknown as MonitoringAlert;
}

function parseContext(value: unknown) {
  if (!isRecord(value) || typeof value.cameraId !== 'string' ||
      !(value.sessionId === null || typeof value.sessionId === 'string') ||
      !PIPELINE_STATES.has(value.pipelineState as PipelineState)) {
    throw new Error('INVALID_ALERT_RESPONSE');
  }
  return value;
}

async function getJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { method: 'GET', signal, cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new Error('ALERT_API_UNAVAILABLE');
  return response.json();
}

export async function getLatestAlert(signal: AbortSignal): Promise<LatestAlertResponse> {
  const value = parseContext(await getJson(`${API_BASE}/latest`, signal));
  if (!(value.alert === null || isRecord(value.alert))) throw new Error('INVALID_ALERT_RESPONSE');
  return { ...value, alert: value.alert === null ? null : parseAlert(value.alert) } as LatestAlertResponse;
}

export async function getAlertHistory(signal: AbortSignal): Promise<AlertHistoryResponse> {
  const value = parseContext(await getJson(`${API_BASE}?limit=20`, signal));
  if (!Array.isArray(value.alerts) || value.alerts.length > 20 ||
      !Number.isSafeInteger(value.retained) || !Number.isSafeInteger(value.totalCreated) ||
      !Number.isSafeInteger(value.capacity)) throw new Error('INVALID_ALERT_RESPONSE');
  const alerts = value.alerts.map(parseAlert);
  if (new Set(alerts.map(alert => alert.id)).size !== alerts.length) throw new Error('INVALID_ALERT_RESPONSE');
  return { ...value, alerts } as AlertHistoryResponse;
}

export function formatMonitoringTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('vi-VN', { hour12: false });
}
