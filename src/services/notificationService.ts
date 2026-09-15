import { Notification } from '../types';
import { INITIAL_NOTIFICATIONS } from './mockData';
import { realtimeService } from './realtimeService';

class NotificationService {
  private notifications: Notification[] = [...INITIAL_NOTIFICATIONS];

  public async getNotifications(): Promise<Notification[]> {
    return [...this.notifications];
  }

  public getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  public async markAsRead(id: string): Promise<boolean> {
    const item = this.notifications.find((n) => n.id === id);
    if (item) {
      item.read = true;
      realtimeService.notifyGlobalChange();
      return true;
    }
    return false;
  }

  public async markAllAsRead(): Promise<void> {
    this.notifications.forEach((n) => (n.read = true));
    realtimeService.notifyGlobalChange();
  }

  public addNotification(data: Omit<Notification, 'id' | 'timestamp' | 'read'>): Notification {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
    const newNotif: Notification = {
      ...data,
      id: `notif-${Date.now()}`,
      timestamp: timeStr,
      read: false,
    };

    this.notifications.unshift(newNotif);
    realtimeService.dispatchNotification(newNotif);
    return newNotif;
  }
}

export const notificationService = new NotificationService();
