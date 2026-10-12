import { Camera, CameraStatus } from '../types';
import { realtimeService } from './realtimeService';
import { backendRequest, jsonRequest } from './backendApi';

class CameraService {
  public getCameras(): Promise<Camera[]> { return backendRequest('/cameras'); }
  public getCamera(id: string): Promise<Camera | null> {
    return backendRequest(`/cameras/${encodeURIComponent(id)}`, {}, true);
  }
  public async addCamera(camera: Omit<Camera, 'id'>): Promise<Camera> {
    const created = await backendRequest<Camera>('/cameras', jsonRequest('POST', camera));
    realtimeService.dispatchCameraUpdate(created);
    return created;
  }
  public async updateCamera(id: string, updates: Partial<Camera>): Promise<Camera | null> {
    const updated = await backendRequest<Camera | null>(`/cameras/${encodeURIComponent(id)}`, jsonRequest('PUT', updates), true);
    if (updated) realtimeService.dispatchCameraUpdate(updated);
    return updated;
  }
  public async deleteCamera(id: string): Promise<boolean> {
    const result = await backendRequest<unknown>(`/cameras/${encodeURIComponent(id)}`, { method: 'DELETE' }, true);
    if (!result) return false;
    realtimeService.notifyGlobalChange();
    return true;
  }
  public setCameraStatus(id: string, status: CameraStatus, aiStatus: Camera['aiStatus'],
    fireConfidence = 0, smokeConfidence = 0): Promise<Camera | null> {
    return this.updateCamera(id, { status, aiStatus, fireConfidence, smokeConfidence,
      lastUpdate: new Date().toLocaleTimeString('vi-VN', { hour12: false }) });
  }
}
export const cameraService = new CameraService();
