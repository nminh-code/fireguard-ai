import {
  CameraConnectionConfig,
  CameraConnectionResult,
  CameraConnectionStatus,
} from '../types';

/**
 * Camera Connection Service
 *
 * Frontend service abstraction layer for managing CCTV/IP camera connections.
 * This service communicates with the Laravel Backend API.
 * The backend is responsible for:
 *   1. Direct RTSP / ONVIF handshake with physical cameras
 *   2. Credential validation inside secure network
 *   3. AI Computer Vision pipelines and stream ingestion
 *
 * Currently operating in [MOCK / PRE-INTEGRATION MODE]:
 * If the Laravel backend is not yet available, calls will safely report
 * 'Backend connection service not configured'.
 */

// Planned backend API endpoints (to be implemented via Codex in Laravel)
export const CAMERA_API_ENDPOINTS = {
  TEST_CONNECTION: '/api/v1/cameras/test-connection',
  SAVE_CAMERA: '/api/v1/cameras',
  GET_STATUS: (id: string) => `/api/v1/cameras/${id}/status`,
  DISCONNECT: (id: string) => `/api/v1/cameras/${id}/disconnect`,
};

const STORAGE_KEY = 'fireguard_saved_camera_configs';

// Seed sample configurations for UI display (Non-sensitive / placeholders)
const INITIAL_SAVED_CONFIGS: CameraConnectionConfig[] = [
  {
    id: 'CAM-TEST-01',
    name: 'Camera Cổng Chính (Mock Local)',
    brand: 'Hikvision',
    model: 'DS-2CD2043G2-I',
    ip: '192.168.1.101',
    port: 554,
    protocol: 'RTSP',
    username: 'admin',
    // NO hardcoded real password
    password: '',
    streamUrl: 'rtsp://192.168.1.101:554/Streaming/Channels/101',
  },
  {
    id: 'CAM-TEST-02',
    name: 'Camera Kho B TP.Hải Phòng (Mock Local)',
    brand: 'Dahua',
    model: 'IPC-HFW2431S-S-S2',
    ip: '192.168.1.102',
    port: 80,
    protocol: 'ONVIF',
    username: 'admin',
    password: '',
  },
];

class CameraConnectionService {
  private savedCameras: CameraConnectionConfig[] = [];
  private connectionStatuses: Record<string, CameraConnectionStatus> = {};

  constructor() {
    this.loadFromStorage();
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
      // Clean sensitive fields before storage if any
      const sanitized = this.savedCameras.map((c) => ({
        ...c,
        password: c.password ? '******' : '',
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // Ignore storage errors in sandbox
    }
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
   *
   * Flow:
   * 1. Attempts to invoke POST /api/v1/cameras/test-connection on the backend
   * 2. If the backend is not yet reached/configured, strictly returns FAILED status
   *    with 'Backend connection service not configured' (no fake CONNECTED).
   */
  async testConnection(
    cameraConfig: CameraConnectionConfig
  ): Promise<CameraConnectionResult> {
    this.connectionStatuses[cameraConfig.id] = 'CONNECTING';

    try {
      // Send payload without logging password
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
          details: data,
        };
      }

      // Backend returned HTTP error status
      this.connectionStatuses[cameraConfig.id] = 'FAILED';
      const errText = await response.text();
      return {
        cameraId: cameraConfig.id,
        status: 'FAILED',
        streamStatus: 'UNAVAILABLE',
        apiStatus: 'UNAVAILABLE',
        lastChecked: this.getFormattedTimestamp(),
        errorMessage: `Backend response (${response.status}): ${
          errText || response.statusText || 'Lỗi kiểm tra kết nối camera'
        }`,
      };
    } catch {
      // Backend not yet available or fetch failed
      this.connectionStatuses[cameraConfig.id] = 'FAILED';
      return {
        cameraId: cameraConfig.id,
        status: 'FAILED',
        streamStatus: 'UNAVAILABLE',
        apiStatus: 'UNAVAILABLE',
        lastChecked: this.getFormattedTimestamp(),
        errorMessage: 'Backend connection service not configured',
      };
    }
  }

  /**
   * Save or update camera connection configuration in local storage / mock state.
   */
  async saveCamera(
    cameraConfig: CameraConnectionConfig
  ): Promise<{ success: boolean; camera: CameraConnectionConfig }> {
    const existingIndex = this.savedCameras.findIndex(
      (c) => c.id === cameraConfig.id
    );

    if (existingIndex >= 0) {
      this.savedCameras[existingIndex] = { ...cameraConfig };
    } else {
      this.savedCameras.push({ ...cameraConfig });
    }

    if (!this.connectionStatuses[cameraConfig.id]) {
      this.connectionStatuses[cameraConfig.id] = 'NOT_CONNECTED';
    }

    this.persistToStorage();

    // Optionally notify backend if available in the future
    try {
      fetch(CAMERA_API_ENDPOINTS.SAVE_CAMERA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cameraConfig),
      }).catch(() => {});
    } catch {
      // Silent catch for mock phase
    }

    return { success: true, camera: cameraConfig };
  }

  /**
   * Get current connection status of a camera by ID.
   */
  async getCameraConnectionStatus(
    cameraId: string
  ): Promise<CameraConnectionStatus> {
    return this.connectionStatuses[cameraId] || 'NOT_CONNECTED';
  }

  /**
   * Disconnect a camera stream/session.
   */
  async disconnectCamera(cameraId: string): Promise<{ success: boolean }> {
    this.connectionStatuses[cameraId] = 'DISCONNECTED';

    try {
      fetch(CAMERA_API_ENDPOINTS.DISCONNECT(cameraId), {
        method: 'POST',
      }).catch(() => {});
    } catch {
      // Silent catch
    }

    return { success: true };
  }

  /**
   * Get all saved camera configurations (Mock/Local State).
   */
  getSavedCameras(): CameraConnectionConfig[] {
    return [...this.savedCameras];
  }

  /**
   * Delete a saved camera configuration.
   */
  deleteCamera(cameraId: string): boolean {
    this.savedCameras = this.savedCameras.filter((c) => c.id !== cameraId);
    delete this.connectionStatuses[cameraId];
    this.persistToStorage();
    return true;
  }
}

export const cameraConnectionService = new CameraConnectionService();
