import { Camera, CameraStatus } from '../types';
import { INITIAL_CAMERAS } from './mockData';
import { realtimeService } from './realtimeService';

class CameraService {
  private cameras: Camera[] = [...INITIAL_CAMERAS];

  public async getCameras(): Promise<Camera[]> {
    // Return a shallow copy
    return [...this.cameras];
  }

  public async getCamera(id: string): Promise<Camera | null> {
    const cam = this.cameras.find((c) => c.id === id || c.code.toLowerCase() === id.toLowerCase());
    return cam ? { ...cam } : null;
  }

  public async addCamera(camera: Omit<Camera, 'id'>): Promise<Camera> {
    const newCam: Camera = {
      ...camera,
      id: `cam-${(this.cameras.length + 1).toString().padStart(2, '0')}`,
    };
    this.cameras.push(newCam);
    realtimeService.dispatchCameraUpdate(newCam);
    return newCam;
  }

  public async updateCamera(id: string, updates: Partial<Camera>): Promise<Camera | null> {
    const index = this.cameras.findIndex((c) => c.id === id || c.code === id);
    if (index === -1) return null;

    this.cameras[index] = { ...this.cameras[index], ...updates };
    realtimeService.dispatchCameraUpdate(this.cameras[index]);
    return { ...this.cameras[index] };
  }

  public async deleteCamera(id: string): Promise<boolean> {
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

    this.cameras[index] = {
      ...this.cameras[index],
      status,
      aiStatus,
      fireConfidence,
      smokeConfidence,
      lastUpdate: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
    };

    realtimeService.dispatchCameraUpdate(this.cameras[index]);
    return { ...this.cameras[index] };
  }
}

export const cameraService = new CameraService();
