import { Camera, CameraConnectionConfig, CameraConnectionResult, CameraStatus } from '../models/camera.model.js';
import { cameraRepository } from '../repositories/camera.repository.js';
import { config } from '../config/index.js';

export class CameraService {
  public async getCameras(filters?: {
    zoneId?: string;
    status?: CameraStatus;
    search?: string;
  }): Promise<Camera[]> {
    let list = await cameraRepository.findAll();

    if (filters) {
      if (filters.zoneId && filters.zoneId !== 'ALL') {
        list = list.filter((c) => c.zoneId === filters.zoneId);
      }
      if (filters.status && filters.status !== ('ALL' as any)) {
        list = list.filter((c) => c.status === filters.status);
      }
      if (filters.search) {
        const query = filters.search.toLowerCase();
        list = list.filter(
          (c) =>
            c.code.toLowerCase().includes(query) ||
            c.name.toLowerCase().includes(query) ||
            c.location.toLowerCase().includes(query)
        );
      }
    }

    return list;
  }

  public async getCameraById(id: string): Promise<Camera | null> {
    return cameraRepository.findById(id);
  }

  public async addCamera(data: Omit<Camera, 'id'> & { id?: string }): Promise<Camera> {
    return cameraRepository.create(data);
  }

  public async updateCamera(id: string, updates: Partial<Camera>): Promise<Camera | null> {
    return cameraRepository.update(id, updates);
  }

  public async deleteCamera(id: string): Promise<boolean> {
    return cameraRepository.delete(id);
  }

  // --- Saved Connection Configs ---
  public async getSavedConfigs(): Promise<CameraConnectionConfig[]> {
    return cameraRepository.findAllConfigs();
  }

  public async getSavedConfigById(id: string): Promise<CameraConnectionConfig | null> {
    return cameraRepository.findConfigById(id);
  }

  public async saveConfig(configData: CameraConnectionConfig): Promise<CameraConnectionConfig> {
    const saved = await cameraRepository.saveConfig(configData);

    // If config has streamUrl/ip, ensure Video Bridge also knows about it
    try {
      fetch(`${config.videoBridgeUrl}/api/v1/cameras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      }).catch(() => {});
    } catch {}

    return saved;
  }

  public async deleteConfig(id: string): Promise<boolean> {
    return cameraRepository.deleteConfig(id);
  }

  // --- Video Bridge Proxy / Relay for Tests ---
  public async testConnection(
    cameraConfig: CameraConnectionConfig
  ): Promise<CameraConnectionResult> {
    try {
      const bridgeUrl = `${config.videoBridgeUrl}/api/v1/cameras/test-connection`;
      const response = await fetch(bridgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(cameraConfig),
      });

      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        const connected = data.status === 'CONNECTED' || (!('status' in data) && data.streamStatus === 'AVAILABLE');
        if (!connected) {
          return { cameraId: cameraConfig.id, status: 'FAILED', streamStatus: 'UNAVAILABLE', apiStatus: 'UNAVAILABLE',
            lastChecked: new Date().toISOString(), errorMessage: String(data.errorMessage || 'Camera không trả về luồng RTSP hợp lệ.'), details: data };
        }
        return {
          cameraId: cameraConfig.id,
          status: 'CONNECTED',
          streamStatus: (data.streamStatus as any) || 'AVAILABLE',
          apiStatus: (data.apiStatus as any) || 'AVAILABLE',
          lastChecked: new Date().toISOString(),
          latencyMs: data.latencyMs as number,
          playbackUrl: data.playbackUrl as string,
          webrtcUrl: data.webrtcUrl as string,
          details: data,
        };
      }

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
        lastChecked: new Date().toISOString(),
        errorMessage: message || 'Lỗi kết nối từ Video Bridge',
      };
    } catch {
      return {
        cameraId: cameraConfig.id,
        status: 'FAILED',
        streamStatus: 'UNAVAILABLE',
        apiStatus: 'UNAVAILABLE',
        lastChecked: new Date().toISOString(),
        errorMessage: `Không thể kết nối đến Video Bridge tại ${config.videoBridgeUrl}. Hãy kiểm tra xem Video Bridge đang chạy trên port 8787.`,
      };
    }
  }

  public async getStreamStatus(cameraId: string): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(
        `${config.videoBridgeUrl}/api/v1/cameras/${encodeURIComponent(cameraId)}/status`
      );
      if (response.ok) {
        return (await response.json()) as Record<string, unknown>;
      }
    } catch {}
    return { status: 'NOT_CONNECTED' };
  }

  public async disconnectStream(cameraId: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(
        `${config.videoBridgeUrl}/api/v1/cameras/${encodeURIComponent(cameraId)}/disconnect`,
        { method: 'POST' }
      );
      if (response.ok) {
        return (await response.json()) as { success: boolean };
      }
    } catch {}
    return { success: true };
  }
}

export const cameraService = new CameraService();
