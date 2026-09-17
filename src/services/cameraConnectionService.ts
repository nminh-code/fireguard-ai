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

const INITIAL_SAVED_CONFIGS: CameraConnectionConfig[] = [];

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
      const sanitized = this.savedCameras.map((c) => this.sanitizeForStorage(c));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // Ignore storage errors in sandbox
    }
  }

  private sanitizeForStorage(config: CameraConnectionConfig): CameraConnectionConfig {
    let streamUrl = config.streamUrl || '';
    try {
      const parsed = new URL(streamUrl);
      parsed.username = '';
      parsed.password = '';
      streamUrl = parsed.toString();
    } catch {
      // Preserve incomplete/non-URL paths, but never persist an obvious credential section.
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
          playbackUrl: data.playbackUrl,
          details: data,
        };
      }

      // Backend returned HTTP error status
      this.connectionStatuses[cameraConfig.id] = 'FAILED';
      const errText = await response.text();
      let message = errText;
      try {
        message = (JSON.parse(errText) as { error?: string }).error || errText;
      } catch {
        // The bridge may return plain text for an infrastructure error.
      }
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
      // Backend not yet available or fetch failed
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
   * Save or update camera connection configuration in local storage / mock state.
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

    // Optionally notify backend if available in the future
    try {
      const sanitizedConfig = safeConfig;
      fetch(CAMERA_API_ENDPOINTS.SAVE_CAMERA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedConfig),
      }).catch(() => {});
    } catch {
      // Silent catch for mock phase
    }

    return { success: true, camera: safeConfig };
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
