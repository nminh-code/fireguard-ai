import {
  CameraConnectionConfig,
  CameraConnectionResult,
  CameraConnectionStatus,
} from '../types';

/**
 * Camera Connection Service
 *
 * Frontend service abstraction layer for managing CCTV/IP camera connections.
 * Communicates with the FAVIS AI Backend API & Video Bridge.
 */

const BACKEND_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

// Backend / Bridge API endpoints
export const CAMERA_API_ENDPOINTS = {
  TEST_CONNECTION: '/api/v1/cameras/test-connection',
  SAVE_CAMERA: `${BACKEND_BASE_URL}/cameras/configs`,
  GET_STATUS: (id: string) => `/api/v1/cameras/${encodeURIComponent(id)}/status`,
  DISCONNECT: (id: string) => `/api/v1/cameras/${encodeURIComponent(id)}/disconnect`,
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

const STORAGE_KEY = 'favis_saved_camera_configs';
const EZVIZ_MIGRATION_KEY = 'favis_camera02_ezviz_added';

const CAMERA_02: CameraConnectionConfig = {
  id: 'camera-02-ezviz', name: 'Camera 02 EZVIZ', brand: 'Ezviz',
  model: 'CS-C6N', ip: '192.168.1.17', port: 554, protocol: 'RTSP',
  username: 'admin', password: '', streamUrl: 'rtsp://192.168.1.17:554/h264/ch1/main',
};

const INITIAL_SAVED_CONFIGS: CameraConnectionConfig[] = [CAMERA_02];

class CameraConnectionService {
  private savedCameras: CameraConnectionConfig[] = [];
  private connectionStatuses: Record<string, CameraConnectionStatus> = {};

  constructor() {
    this.loadFromStorage();
    this.syncWithBackend().catch(() => {});
  }

  private async syncWithBackend(): Promise<void> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/cameras/configs`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          // Merge remote with local configs (remote takes priority)
          const merged = [...json.data];
          this.savedCameras.forEach((local) => {
            if (!merged.some((r: CameraConnectionConfig) => r.id === local.id)) {
              merged.push(local);
              // Push local-only cameras up to Backend
              this.saveCameraToBackend(local).catch(() => {});
            }
          });
          this.savedCameras = merged;
          this.persistToStorage();
        }
      }
    } catch {
      // Backend not reached, keep existing local storage state
    }
  }

  private async saveCameraToBackend(config: CameraConnectionConfig): Promise<void> {
    try {
      await fetch(`${BACKEND_BASE_URL}/cameras/configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
    } catch {}
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.savedCameras = JSON.parse(raw);
      } else {
        this.savedCameras = [...INITIAL_SAVED_CONFIGS];
        this.persistToStorage();
      }
      // Add once to existing installations without replacing Camera 01 or user edits.
      if (!localStorage.getItem(EZVIZ_MIGRATION_KEY)) {
        const existing = this.savedCameras.some(camera => camera.id === CAMERA_02.id ||
          (camera.ip === CAMERA_02.ip && camera.brand === 'Ezviz'));
        if (!existing) this.savedCameras.push({ ...CAMERA_02 });
        this.persistToStorage();
        localStorage.setItem(EZVIZ_MIGRATION_KEY, '1');
      }

      // Auto-shorten legacy long UUID IDs
      let hasLongId = false;
      this.savedCameras = this.savedCameras.map((cam) => {
        if (cam.id && cam.id.length > 20 && cam.id.includes('-')) {
          hasLongId = true;
          const shortId = generateShortCameraId(cam.name, this.savedCameras.filter(c => c !== cam));
          return { ...cam, id: shortId };
        }
        return cam;
      });
      if (hasLongId) {
        this.persistToStorage();
      }
    } catch {
      this.savedCameras = [...INITIAL_SAVED_CONFIGS];
    }

    // Default status for all saved cameras is strictly NOT_CONNECTED
    this.savedCameras.forEach((cam) => {
      this.connectionStatuses[cam.id] = 'NOT_CONNECTED';
    });
  }

  private persistToStorage(): void {
    try {
      const sanitized = this.savedCameras.map((c) => this.sanitizeForStorage(c));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch {}
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
        const data = await response.json();
        this.connectionStatuses[cameraConfig.id] = 'CONNECTED';
        return {
          cameraId: cameraConfig.id,
          status: 'CONNECTED',
          streamStatus: data.streamStatus || 'AVAILABLE',
          apiStatus: data.apiStatus || 'AVAILABLE',
          lastChecked: this.getFormattedTimestamp(),
          latencyMs: data.latencyMs,
          playbackUrl: data.playbackUrl,
          webrtcUrl: data.webrtcUrl,
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
    const existingIndex = this.savedCameras.findIndex(
      (c) => c.id === cameraConfig.id
    );

    const safeConfig = this.sanitizeForStorage(cameraConfig);
    if (existingIndex >= 0) {
      this.savedCameras[existingIndex] = safeConfig;
    } else {
      this.savedCameras.push(safeConfig);
    }

    if (!this.connectionStatuses[cameraConfig.id]) {
      this.connectionStatuses[cameraConfig.id] = 'NOT_CONNECTED';
    }

    this.persistToStorage();
    this.saveCameraToBackend(safeConfig).catch(() => {});

    // Also inform video bridge if available
    try {
      fetch('/api/v1/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cameraConfig),
      }).catch(() => {});
    } catch {}

    return { success: true, camera: safeConfig };
  }

  async getCameraConnectionStatus(
    cameraId: string
  ): Promise<CameraConnectionStatus> {
    return this.connectionStatuses[cameraId] || 'NOT_CONNECTED';
  }

  async disconnectCamera(cameraId: string): Promise<{ success: boolean }> {
    this.connectionStatuses[cameraId] = 'DISCONNECTED';

    try {
      fetch(CAMERA_API_ENDPOINTS.DISCONNECT(cameraId), {
        method: 'POST',
      }).catch(() => {});
    } catch {}

    return { success: true };
  }

  getSavedCameras(): CameraConnectionConfig[] {
    return [...this.savedCameras];
  }

  deleteCamera(cameraId: string): boolean {
    this.savedCameras = this.savedCameras.filter((c) => c.id !== cameraId);
    delete this.connectionStatuses[cameraId];
    this.persistToStorage();

    // Sync deletion to Backend
    fetch(`${BACKEND_BASE_URL}/cameras/configs/${encodeURIComponent(cameraId)}`, {
      method: 'DELETE',
    }).catch(() => {});

    return true;
  }
}

export const cameraConnectionService = new CameraConnectionService();
