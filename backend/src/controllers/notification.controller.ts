import { Request, Response } from 'express';
import { notificationService } from '../services/notification.service.js';

export async function getAllNotifications(_req: Request, res: Response): Promise<void> {
  try {
    const data = await notificationService.getNotifications();
    const unreadCount = await notificationService.getUnreadCount();

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      data,
      unreadCount,
      count: data.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi lấy danh sách thông báo' },
    });
  }
}

export async function markNotificationAsRead(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      res.status(400).json({
        success: false,
        error: { message: 'ID thông báo không hợp lệ' },
      });
      return;
    }

    const updated = await notificationService.markAsRead(id);
    if (!updated) {
      res.status(404).json({
        success: false,
        error: { message: `Không tìm thấy thông báo với ID: ${id}` },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi cập nhật trạng thái thông báo' },
    });
  }
}

export async function markAllNotificationsAsRead(_req: Request, res: Response): Promise<void> {
  try {
    const result = await notificationService.markAllAsRead();
    res.status(200).json({
      success: true,
      data: {
        message: 'Đã đánh dấu tất cả thông báo là đã đọc',
        updatedCount: result.updatedCount,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi đánh dấu tất cả thông báo đã đọc' },
    });
  }
}

export async function createNotification(req: Request, res: Response): Promise<void> {
  try {
    const { type, title, message, location, cameraCode, incidentId, severity, id, timestamp } =
      req.body || {};

    if (!type || !title || !message) {
      res.status(400).json({
        success: false,
        error: { message: 'Thiếu các trường bắt buộc: type, title, message' },
      });
      return;
    }

    const validTypes = ['FIRE_CONFIRMED', 'CAMERA_OFFLINE', 'INCIDENT_UPDATE', 'SYSTEM'];
    if (!validTypes.includes(type)) {
      res.status(400).json({
        success: false,
        error: { message: `Loại thông báo không hợp lệ: ${type}. Cho phép: ${validTypes.join(', ')}` },
      });
      return;
    }

    const created = await notificationService.createNotification({
      type,
      title,
      message,
      location,
      cameraCode,
      incidentId,
      severity,
      id,
      timestamp,
    });

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi tạo thông báo mới' },
    });
  }
}
