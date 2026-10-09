import { Notification } from '../types';
import { INITIAL_NOTIFICATIONS } from './mockData';
import { realtimeService } from './realtimeService';

const BACKEND_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

class NotificationService {
  private notificationsCache: Notification[] = [...INITIAL_NOTIFICATIONS];

  public async getNotifications(): Promise<Notification[]> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/notifications`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          this.notificationsCache = json.data;
          return [...this.notificationsCache];
        }
      }
    } catch {
      // Fallback to cache if backend is unavailable
    }
    return [...this.notificationsCache];
  }

  public getUnreadCount(): number {
    return this.notificationsCache.filter((n) => !n.read).length;
  }

  public async markAsRead(id: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${BACKEND_BASE_URL}/notifications/${encodeURIComponent(id)}/read`,
        {
          method: 'PATCH',
        }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const idx = this.notificationsCache.findIndex((n) => n.id === id);
          if (idx !== -1) {
            this.notificationsCache[idx] = json.data;
          }
          realtimeService.notifyGlobalChange();
          return true;
        }
      }
    } catch {
      // Fallback
    }

    const item = this.notificationsCache.find((n) => n.id === id);
    if (item) {
      item.read = true;
      realtimeService.notifyGlobalChange();
      return true;
    }
    return false;
  }

  public async markAllAsRead(): Promise<void> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/notifications/read-all`, {
        method: 'PATCH',
      });
      if (res.ok) {
        this.notificationsCache.forEach((n) => (n.read = true));
        realtimeService.notifyGlobalChange();
        return;
      }
    } catch {
      // Fallback
    }

    this.notificationsCache.forEach((n) => (n.read = true));
    realtimeService.notifyGlobalChange();
  }

  public async addNotification(
    data: Omit<Notification, 'id' | 'timestamp' | 'read'> & Partial<Notification>
  ): Promise<Notification> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const created: Notification = json.data;
          this.notificationsCache.unshift(created);
          realtimeService.dispatchNotification(created);
          return created;
        }
      }
    } catch {
      // Fallback
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
    const fallbackNotif: Notification = {
      ...data,
      id: data.id || `notif-${Date.now()}`,
      timestamp: data.timestamp || timeStr,
      read: false,
    };

    this.notificationsCache.unshift(fallbackNotif);
    realtimeService.dispatchNotification(fallbackNotif);
    return fallbackNotif;
  }
}

export const notificationService = new NotificationService();

