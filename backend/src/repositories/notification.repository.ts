import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Notification } from '../models/notification.model.js';
import { INITIAL_NOTIFICATIONS } from '../data/seedNotifications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

export class NotificationRepository {
  private notifications: Notification[] = [];

  constructor() {
    this.ensureDataFile();
  }

  private ensureDataFile(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (!fs.existsSync(NOTIFICATIONS_FILE)) {
        this.notifications = [...INITIAL_NOTIFICATIONS];
        this.saveToFile(this.notifications);
      } else {
        const raw = fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8');
        this.notifications = JSON.parse(raw);
      }
    } catch (err) {
      console.error('[NotificationRepository] Error initializing data file:', err);
      this.notifications = [...INITIAL_NOTIFICATIONS];
    }
  }

  private saveToFile(data: Notification[]): void {
    try {
      const tempPath = `${NOTIFICATIONS_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, NOTIFICATIONS_FILE);
    } catch (err) {
      console.error(`[NotificationRepository] Error saving to ${NOTIFICATIONS_FILE}:`, err);
    }
  }

  public async findAll(): Promise<Notification[]> {
    this.ensureDataFile();
    return [...this.notifications];
  }

  public async findById(id: string): Promise<Notification | null> {
    this.ensureDataFile();
    const item = this.notifications.find((n) => n.id.toLowerCase() === id.toLowerCase());
    return item ? { ...item } : null;
  }

  public async create(notification: Notification): Promise<Notification> {
    const existing = this.notifications.find(
      (n) => n.id.toLowerCase() === notification.id.toLowerCase()
    );
    if (existing) {
      return { ...existing };
    }

    this.notifications.unshift({ ...notification });
    this.saveToFile(this.notifications);
    return { ...notification };
  }

  public async markAsRead(id: string): Promise<Notification | null> {
    const idx = this.notifications.findIndex((n) => n.id.toLowerCase() === id.toLowerCase());
    if (idx === -1) return null;

    this.notifications[idx] = {
      ...this.notifications[idx],
      read: true,
    };
    this.saveToFile(this.notifications);
    return { ...this.notifications[idx] };
  }

  public async markAllAsRead(): Promise<number> {
    let count = 0;
    this.notifications = this.notifications.map((n) => {
      if (!n.read) {
        count++;
        return { ...n, read: true };
      }
      return n;
    });

    if (count > 0) {
      this.saveToFile(this.notifications);
    }
    return count;
  }

  public async countUnread(): Promise<number> {
    this.ensureDataFile();
    return this.notifications.filter((n) => !n.read).length;
  }
}

export const notificationRepository = new NotificationRepository();
