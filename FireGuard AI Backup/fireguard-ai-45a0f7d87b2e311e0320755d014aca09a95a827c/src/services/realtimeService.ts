import { Incident, Notification, Camera, User } from '../types';

type IncidentEventCallback = (incident: Incident) => void;
type NotificationCallback = (notification: Notification) => void;
type CameraUpdateCallback = (camera: Camera) => void;
type AuthUpdateCallback = (user: User) => void;
type StatusUpdateCallback = () => void;

class RealtimeService {
  private incidentListeners: Set<IncidentEventCallback> = new Set();
  private notificationListeners: Set<NotificationCallback> = new Set();
  private cameraListeners: Set<CameraUpdateCallback> = new Set();
  private authListeners: Set<AuthUpdateCallback> = new Set();
  private globalChangeListeners: Set<StatusUpdateCallback> = new Set();

  /**
   * Subscribe to incident events (FIRE_CONFIRMED, status transitions, resolution)
   * Returns an unsubscribe function for React useEffect cleanup
   */
  public subscribeToIncidentEvents(callback: IncidentEventCallback): () => void {
    this.incidentListeners.add(callback);
    return () => {
      this.incidentListeners.delete(callback);
    };
  }

  /**
   * Subscribe to incoming notifications (realtime emergency alerts)
   */
  public subscribeToNotifications(callback: NotificationCallback): () => void {
    this.notificationListeners.add(callback);
    return () => {
      this.notificationListeners.delete(callback);
    };
  }

  /**
   * Subscribe to camera state changes (status flips, AI confidence updates)
   */
  public subscribeToCameraUpdates(callback: CameraUpdateCallback): () => void {
    this.cameraListeners.add(callback);
    return () => {
      this.cameraListeners.delete(callback);
    };
  }

  /**
   * Subscribe to auth role changes
   */
  public subscribeToAuthEvents(callback: AuthUpdateCallback): () => void {
    this.authListeners.add(callback);
    return () => {
      this.authListeners.delete(callback);
    };
  }

  /**
   * Subscribe to any global state changes (for Dashboard KPI recalculations)
   */
  public subscribeToGlobalState(callback: StatusUpdateCallback): () => void {
    this.globalChangeListeners.add(callback);
    return () => {
      this.globalChangeListeners.delete(callback);
    };
  }

  /**
   * Dispatch an incident event to all active subscribers
   */
  public dispatchIncident(incident: Incident): void {
    this.incidentListeners.forEach((cb) => {
      try {
        cb(incident);
      } catch (err) {
        console.error('Error in incident event callback:', err);
      }
    });
    this.notifyGlobalChange();
  }

  /**
   * Dispatch a notification event to all active subscribers
   */
  public dispatchNotification(notification: Notification): void {
    this.notificationListeners.forEach((cb) => {
      try {
        cb(notification);
      } catch (err) {
        console.error('Error in notification event callback:', err);
      }
    });
    this.notifyGlobalChange();
  }

  /**
   * Dispatch a camera update event
   */
  public dispatchCameraUpdate(camera: Camera): void {
    this.cameraListeners.forEach((cb) => {
      try {
        cb(camera);
      } catch (err) {
        console.error('Error in camera event callback:', err);
      }
    });
    this.notifyGlobalChange();
  }

  /**
   * Dispatch an auth event
   */
  public dispatchAuthEvent(user: User): void {
    this.authListeners.forEach((cb) => {
      try {
        cb(user);
      } catch (err) {
        console.error('Error in auth event callback:', err);
      }
    });
  }

  public notifyGlobalChange(): void {
    this.globalChangeListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Error in global state callback:', err);
      }
    });
  }
}

export const realtimeService = new RealtimeService();
