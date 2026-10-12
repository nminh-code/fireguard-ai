import { Notification } from '../types';
import { realtimeService } from './realtimeService';
import { backendRequest, jsonRequest } from './backendApi';

class NotificationService {
  private notificationsCache: Notification[] = [];
  public async getNotifications(): Promise<Notification[]> {
    this.notificationsCache = await backendRequest<Notification[]>('/notifications');
    return [...this.notificationsCache];
  }
  public getUnreadCount(): number { return this.notificationsCache.filter(item => !item.read).length; }
  public async markAsRead(id: string): Promise<boolean> {
    const updated = await backendRequest<Notification | null>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }, true);
    if (!updated) return false;
    const index = this.notificationsCache.findIndex(item => item.id === id);
    if (index >= 0) this.notificationsCache[index] = updated;
    realtimeService.notifyGlobalChange();
    return true;
  }
  public async markAllAsRead(): Promise<void> {
    await backendRequest('/notifications/read-all', { method: 'PATCH' });
    this.notificationsCache.forEach(item => { item.read = true; });
    realtimeService.notifyGlobalChange();
  }
  public async addNotification(data: Omit<Notification, 'id' | 'timestamp' | 'read'> & Partial<Notification>): Promise<Notification> {
    const created = await backendRequest<Notification>('/notifications', jsonRequest('POST', data));
    this.notificationsCache.unshift(created);
    realtimeService.dispatchNotification(created);
    return created;
  }
}
export const notificationService = new NotificationService();

