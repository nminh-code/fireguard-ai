import {
  CameraConnectionConfig,
  CameraConnectionResult,
  CameraConnectionStatus,
} from '../types';
import { backendRequest, jsonRequest } from './backendApi';

/**
 * Camera Connection Service
 *
 * Frontend service abstraction layer for managing CCTV/IP camera connections.
 * Communicates with the FAVIS AI Backend API & Video Bridge.
 */

const BACKEND_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

// Keep camera control calls on the backend relay. The Vite `/api` proxy points
// at the video bridge for stream assets, while the backend owns this API and
// normalizes bridge failures into a structured camera result.
export const CAMERA_API_ENDPOINTS = {
  TEST_CONNECTION: `${BACKEND_BASE_URL}/cameras/test-connection`,
  SAVE_CAMERA: `${BACKEND_BASE_URL}/cameras/configs`,
  GET_STATUS: (id: string) => `${BACKEND_BASE_URL}/cameras/${encodeURIComponent(id)}/status`,
  DISCONNECT: (id: string) => `${BACKEND_BASE_URL}/cameras/${encodeURIComponent(id)}/disconnect`,
};

export function generateShortCameraId(
  name?: string,
  existingCameras: { id: string }[] = []
): string {
  const safeName = (name || '').trim();

  // 1. Try extracting number from name (e.g. "Camera 01", "CAM 2", "Camera 17")
  const matchNum = safeName.match(/\d+/);
  if (matchNum) {
    const num = matchNum[0].padStart(2, '0');
    const candidate = `cam-${num}`;
    if (!existingCameras.some((c) => c.id.toLowerCase() === candidate.toLowerCase())) {
      return candidate;
    }
  }

  // 2. Try clean slug from brand/name (e.g. "Yoosee" -> "cam-yoosee")
  const clean = safeName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/^(camera|cam)/, '');

  if (clean.length > 0 && clean.length <= 10) {
    const candidate = `cam-${clean}`;
    if (!existingCameras.some((c) => c.id.toLowerCase() === candidate.toLowerCase())) {
      return candidate;
    }
  }

  // 3. Fallback to clean sequential number: cam-01, cam-02, cam-03...
  let seq = 1;
  while (
    existingCameras.some(
      (c) => c.id.toLowerCase() === `cam-${seq.toString().padStart(2, '0')}`
    )
  ) {
    seq++;
  }
  return `cam-${seq.toString().padStart(2, '0')}`;
}

class CameraConnectionService {
  private savedCameras: CameraConnectionConfig[] = [];
  private connectionStatuses: Record<string, CameraConnectionStatus> = {};

  public async refreshSavedCameras(): Promise<CameraConnectionConfig[]> {
    const cameras = await backendRequest<CameraConnectionConfig[]>('/cameras/configs');
    this.savedCameras = cameras.map(camera => this.sanitizeForStorage(camera));
    return [...this.savedCameras];
  }

  private sanitizeForStorage(config: CameraConnectionConfig): CameraConnectionConfig {
    let streamUrl = config.streamUrl || '';
    try {
      const parsed = new URL(streamUrl);
      parsed.username = '';
      parsed.password = '';
      streamUrl = parsed.toString();
    } catch {
      streamUrl = streamUrl.replace(/^(rtsp:\/\/)[^@/]+@/i, '$1');
    }
    return { ...config, password: '', streamUrl };
  }

  private getFormattedTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
      now.getHours()
    )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  /**
   * Test connection to a camera.
   */
  async testConnection(
    cameraConfig: CameraConnectionConfig
  ): Promise<CameraConnectionResult> {
    this.connectionStatuses[cameraConfig.id] = 'CONNECTING';

    try {
      const payload = {
        id: cameraConfig.id,
        name: cameraConfig.name,
        brand: cameraConfig.brand,
        model: cameraConfig.model,
        ip: cameraConfig.ip,
        port: cameraConfig.port,
        protocol: cameraConfig.protocol,
        username: cameraConfig.username,
        password: cameraConfig.password,
        streamUrl: cameraConfig.streamUrl,
        apiUrl: cameraConfig.apiUrl,
      };

      const response = await fetch(CAMERA_API_ENDPOINTS.TEST_CONNECTION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        // The backend always returns HTTP 200 for a completed probe, including
        // a failed RTSP handshake. Do not turn that failure into CONNECTED.
        const connected = data.status === 'CONNECTED' ||
          (!('status' in data) && data.streamStatus === 'AVAILABLE');
        if (!connected) {
          this.connectionStatuses[cameraConfig.id] = 'FAILED';
          return {
            cameraId: cameraConfig.id,
            status: 'FAILED',
            streamStatus: 'UNAVAILABLE',
            apiStatus: 'UNAVAILABLE',
            lastChecked: this.getFormattedTimestamp(),
            errorMessage: typeof data.errorMessage === 'string'
              ? data.errorMessage
              : 'Camera không trả về luồng RTSP hợp lệ.',
            details: data,
          };
        }
        this.connectionStatuses[cameraConfig.id] = 'CONNECTED';
        return {
          cameraId: cameraConfig.id,
          status: 'CONNECTED',
          streamStatus: data.streamStatus === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE',
          apiStatus: data.apiStatus === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE',
          lastChecked: this.getFormattedTimestamp(),
          latencyMs: typeof data.latencyMs === 'number' ? data.latencyMs : undefined,
          playbackUrl: typeof data.playbackUrl === 'string' ? data.playbackUrl : undefined,
          webrtcUrl: typeof data.webrtcUrl === 'string' ? data.webrtcUrl : undefined,
          details: data,
        };
      }

      this.connectionStatuses[cameraConfig.id] = 'FAILED';
      const errText = await response.text();
      let message = errText;
      try {
        message = (JSON.parse(errText) as { error?: string }).error || errText;
      } catch {}
      return {
        cameraId: cameraConfig.id,
        status: 'FAILED',
        streamStatus: 'UNAVAILABLE',
        apiStatus: 'UNAVAILABLE',
        lastChecked: this.getFormattedTimestamp(),
        errorMessage: `Backend response (${response.status}): ${
          message || response.statusText || 'Lỗi kiểm tra kết nối camera'
        }`,
      };
    } catch {
      this.connectionStatuses[cameraConfig.id] = 'FAILED';
      return {
        cameraId: cameraConfig.id,
        status: 'FAILED',
        streamStatus: 'UNAVAILABLE',
        apiStatus: 'UNAVAILABLE',
        lastChecked: this.getFormattedTimestamp(),
        errorMessage: 'Không kết nối được video bridge tại http://localhost:8787. Hãy chạy npm run bridge.',
      };
    }
  }

  /**
   * Save or update camera connection configuration.
   */
  async saveCamera(
    cameraConfig: CameraConnectionConfig
  ): Promise<{ success: boolean; camera: CameraConnectionConfig }> {
    const saved = await backendRequest<CameraConnectionConfig>('/cameras/configs', jsonRequest('POST', cameraConfig));
    const safeConfig = this.sanitizeForStorage(saved);
    const existingIndex = this.savedCameras.findIndex(camera => camera.id === saved.id);
    if (existingIndex >= 0) this.savedCameras[existingIndex] = safeConfig;
    else this.savedCameras.push(safeConfig);
    this.connectionStatuses[saved.id] ||= 'NOT_CONNECTED';
    return { success: true, camera: safeConfig };
  }

  async getCameraConnectionStatus(
    cameraId: string
  ): Promise<CameraConnectionStatus> {
    return this.connectionStatuses[cameraId] || 'NOT_CONNECTED';
  }

  async disconnectCamera(cameraId: string): Promise<{ success: boolean }> {
    const response = await fetch(CAMERA_API_ENDPOINTS.DISCONNECT(cameraId), { method: 'POST' });
    if (!response.ok) throw new Error('CAMERA_DISCONNECT_FAILED');
    const result = await response.json();
    if (result.success !== true) throw new Error('CAMERA_DISCONNECT_FAILED');
    this.connectionStatuses[cameraId] = 'DISCONNECTED';
    return result;
  }

  getSavedCameras(): CameraConnectionConfig[] {
    return [...this.savedCameras];
  }

  async deleteCamera(cameraId: string): Promise<boolean> {
    await backendRequest(`/cameras/configs/${encodeURIComponent(cameraId)}`, { method: 'DELETE' });
    this.savedCameras = this.savedCameras.filter(camera => camera.id !== cameraId);
    delete this.connectionStatuses[cameraId];
    return true;
  }

}

export const cameraConnectionService = new CameraConnectionService();
