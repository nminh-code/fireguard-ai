import { Notification, NotificationType } from '../models/notification.model.js';
import { notificationRepository } from '../repositories/notification.repository.js';

export class NotificationService {
  public async getNotifications(): Promise<Notification[]> {
    return notificationRepository.findAll();
  }

  public async getUnreadCount(): Promise<number> {
    return notificationRepository.countUnread();
  }

  public async markAsRead(id: string): Promise<Notification | null> {
    return notificationRepository.markAsRead(id);
  }

  public async markAllAsRead(): Promise<{ updatedCount: number }> {
    const updatedCount = await notificationRepository.markAllAsRead();
    return { updatedCount };
  }

  public async createNotification(
    data: {
      type: NotificationType;
      title: string;
      message: string;
      location?: string;
      cameraCode?: string;
      incidentId?: string;
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      id?: string;
      timestamp?: string;
      read?: boolean;
    }
  ): Promise<Notification> {
    const now = new Date();
    const timeStr = data.timestamp || now.toLocaleTimeString('vi-VN', { hour12: false });
    const id = data.id || `notif-${Date.now()}`;

    const newNotification: Notification = {
      id,
      type: data.type,
      title: data.title,
      message: data.message,
      location: data.location,
      cameraCode: data.cameraCode,
      incidentId: data.incidentId,
      severity: data.severity || 'LOW',
      timestamp: timeStr,
      read: data.read ?? false,
    };

    return notificationRepository.create(newNotification);
  }
}

export const notificationService = new NotificationService();
