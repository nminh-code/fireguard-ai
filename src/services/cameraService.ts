import { Camera, CameraStatus } from '../types';
import { INITIAL_CAMERAS } from './mockData';
import { realtimeService } from './realtimeService';

const BACKEND_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

class CameraService {
  private cameras: Camera[] = [...INITIAL_CAMERAS];
  private isLoaded: boolean = false;

  constructor() {
    this.fetchCamerasFromBackend().catch(() => {});
  }

  private async fetchCamerasFromBackend(): Promise<Camera[]> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/cameras`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          this.cameras = json.data;
          this.isLoaded = true;
          return [...this.cameras];
        }
      }
    } catch (err) {
      // Backend not yet available, keep current in-memory / seed state
    }
    return [...this.cameras];
  }

  public async getCameras(): Promise<Camera[]> {
    await this.fetchCamerasFromBackend();
    return [...this.cameras];
  }

  public async getCamera(id: string): Promise<Camera | null> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/cameras/${encodeURIComponent(id)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const remoteCam: Camera = json.data;
          // Update local cache
          const idx = this.cameras.findIndex(
            (c) => c.id.toLowerCase() === id.toLowerCase() || c.code.toLowerCase() === id.toLowerCase()
          );
          if (idx >= 0) this.cameras[idx] = remoteCam;
          else this.cameras.push(remoteCam);
          return { ...remoteCam };
        }
      }
    } catch {
      // Fallback local search
    }

    const cam = this.cameras.find(
      (c) => c.id.toLowerCase() === id.toLowerCase() || c.code.toLowerCase() === id.toLowerCase()
    );
    return cam ? { ...cam } : null;
  }

  public async addCamera(camera: Omit<Camera, 'id'>): Promise<Camera> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/cameras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(camera),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const newCam: Camera = json.data;
          this.cameras.push(newCam);
          realtimeService.dispatchCameraUpdate(newCam);
          return newCam;
        }
      }
    } catch {
      // Offline fallback
    }

    const newCam: Camera = {
      ...camera,
      id: `cam-${(this.cameras.length + 1).toString().padStart(2, '0')}`,
    };
    this.cameras.push(newCam);
    realtimeService.dispatchCameraUpdate(newCam);
    return newCam;
  }

  public async updateCamera(id: string, updates: Partial<Camera>): Promise<Camera | null> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/cameras/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const updated: Camera = json.data;
          const idx = this.cameras.findIndex((c) => c.id === id || c.code === id);
          if (idx >= 0) this.cameras[idx] = updated;
          realtimeService.dispatchCameraUpdate(updated);
          return { ...updated };
        }
      }
    } catch {
      // Offline fallback
    }

    const index = this.cameras.findIndex((c) => c.id === id || c.code === id);
    if (index === -1) return null;

    this.cameras[index] = { ...this.cameras[index], ...updates };
    realtimeService.dispatchCameraUpdate(this.cameras[index]);
    return { ...this.cameras[index] };
  }

  public async deleteCamera(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/cameras/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        this.cameras = this.cameras.filter((c) => c.id !== id && c.code !== id);
        realtimeService.notifyGlobalChange();
        return true;
      }
    } catch {
      // Offline fallback
    }

    const initialLen = this.cameras.length;
    this.cameras = this.cameras.filter((c) => c.id !== id && c.code !== id);
    realtimeService.notifyGlobalChange();
    return this.cameras.length < initialLen;
  }

  public setCameraStatus(
    id: string,
    status: CameraStatus,
    aiStatus: Camera['aiStatus'],
    fireConfidence = 0,
    smokeConfidence = 0
  ): Camera | null {
    const index = this.cameras.findIndex((c) => c.id === id || c.code === id);
    if (index === -1) return null;

    const updates: Partial<Camera> = {
      status,
      aiStatus,
      fireConfidence,
      smokeConfidence,
      lastUpdate: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
    };

    this.cameras[index] = {
      ...this.cameras[index],
      ...updates,
    };

    // Async sync with Backend in background
    this.updateCamera(id, updates).catch(() => {});

    realtimeService.dispatchCameraUpdate(this.cameras[index]);
    return { ...this.cameras[index] };
  }
}

export const cameraService = new CameraService();
