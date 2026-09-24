import {
  CameraConnectionConfig,
  CameraConnectionResult,
  CameraConnectionStatus,
} from '../types';

export interface SharedCameraStream {
  connected: boolean;
  cameraId: string;
  cameraName: string;
  status: CameraConnectionStatus;
  playbackUrl: string;
}

export interface CameraSessionSnapshot {
  formData: CameraConnectionConfig;
  connectionStatus: CameraConnectionStatus;
  connectionResult: CameraConnectionResult | null;
  activeStream: SharedCameraStream | null;
}

const createEmptyForm = (): CameraConnectionConfig => ({
  id: '',
  name: '',
  brand: 'Hikvision',
  ip: '',
  port: 554,
  protocol: 'RTSP',
  username: '',
  password: '',
  streamUrl: '',
});

class CameraSessionStore {
  private snapshot: CameraSessionSnapshot = {
    formData: createEmptyForm(),
    connectionStatus: 'NOT_CONNECTED',
    connectionResult: null,
    activeStream: null,
  };

  private listeners = new Set<() => void>();

  getSnapshot = (): CameraSessionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(next: CameraSessionSnapshot): void {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }

  updateDraft(formData: CameraConnectionConfig): void {
    this.publish({ ...this.snapshot, formData: { ...formData } });
  }

  setConnecting(formData: CameraConnectionConfig): void {
    this.publish({
      ...this.snapshot,
      formData: { ...formData },
      connectionStatus: 'CONNECTING',
      connectionResult: null,
    });
  }

  setConnectionResult(
    formData: CameraConnectionConfig,
    result: CameraConnectionResult
  ): void {
    const playbackUrl = typeof result.playbackUrl === 'string'
      ? result.playbackUrl
      : '';
    const isConnected = result.status === 'CONNECTED' && playbackUrl.length > 0;
    const activeStream = isConnected
      ? {
          connected: true,
          cameraId: result.cameraId,
          cameraName: formData.name,
          status: result.status,
          playbackUrl,
        }
      : this.snapshot.activeStream?.cameraId === result.cameraId
        ? null
        : this.snapshot.activeStream;

    this.publish({
      formData: { ...formData },
      connectionStatus: result.status,
      connectionResult: { ...result },
      activeStream,
    });
  }

  replaceDraft(formData: CameraConnectionConfig): void {
    this.publish({
      ...this.snapshot,
      formData: { ...formData },
      connectionStatus: 'NOT_CONNECTED',
      connectionResult: null,
    });
  }

  resetCameraTest(): void {
    this.publish({
      ...this.snapshot,
      formData: createEmptyForm(),
      connectionStatus: 'NOT_CONNECTED',
      connectionResult: null,
    });
  }
}

export const cameraSessionStore = new CameraSessionStore();
