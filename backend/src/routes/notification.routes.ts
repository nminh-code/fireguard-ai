import { Router } from 'express';
import {
  getAllNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  createNotification,
} from '../controllers/notification.controller.js';

export const notificationRouter = Router();

// GET all notifications: /api/v1/notifications
notificationRouter.get('/notifications', getAllNotifications);

// PATCH mark all as read: /api/v1/notifications/read-all (MUST be defined before :id/read)
notificationRouter.patch('/notifications/read-all', markAllNotificationsAsRead);

// PATCH mark single as read: /api/v1/notifications/:id/read
notificationRouter.patch('/notifications/:id/read', markNotificationAsRead);

// POST create notification: /api/v1/notifications
notificationRouter.post('/notifications', createNotification);
