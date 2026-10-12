import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../models/user.model.js';
import { INITIAL_USERS } from '../data/seedUsers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

export class UserRepository {
  private users: User[] = [];

  constructor() {
    this.ensureDataFile();
  }

  private ensureDataFile(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (!fs.existsSync(USERS_FILE)) {
        this.users = [...INITIAL_USERS];
        this.saveToFile(this.users);
      } else {
        const raw = fs.readFileSync(USERS_FILE, 'utf-8');
        this.users = JSON.parse(raw);
      }
    } catch (err) {
      console.error('[UserRepository] Error initializing data file:', err);
      this.users = [...INITIAL_USERS];
    }
  }

  private saveToFile(data: User[]): void {
    try {
      const tempPath = `${USERS_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, USERS_FILE);
    } catch (err) {
      console.error(`[UserRepository] Error saving to ${USERS_FILE}:`, err);
    }
  }

  public async findAll(): Promise<User[]> {
    this.ensureDataFile();
    return [...this.users];
  }

  public async findById(id: string): Promise<User | null> {
    this.ensureDataFile();
    const user = this.users.find((u) => u.id.toLowerCase() === id.toLowerCase());
    return user ? { ...user } : null;
  }

  public async findByEmail(email: string): Promise<User | null> {
    this.ensureDataFile();
    const trimmed = email.trim().toLowerCase();
    const user = this.users.find((u) => u.email.toLowerCase() === trimmed);
    return user ? { ...user } : null;
  }

  public async create(user: User): Promise<User> {
    this.ensureDataFile();
    const existing = this.users.find(
      (u) =>
        u.id.toLowerCase() === user.id.toLowerCase() ||
        u.email.toLowerCase() === user.email.trim().toLowerCase()
    );
    if (existing) {
      return { ...existing };
    }

    this.users.push({ ...user });
    this.saveToFile(this.users);
    return { ...user };
  }

  public async update(id: string, updates: Partial<User>): Promise<User | null> {
    this.ensureDataFile();
    const idx = this.users.findIndex((u) => u.id.toLowerCase() === id.toLowerCase());
    if (idx === -1) return null;

    this.users[idx] = {
      ...this.users[idx],
      ...updates,
      id: this.users[idx].id, // preserve immutable ID
    };
    this.saveToFile(this.users);
    return { ...this.users[idx] };
  }

  public async delete(id: string): Promise<boolean> {
    this.ensureDataFile();
    const initialLen = this.users.length;
    this.users = this.users.filter((u) => u.id.toLowerCase() !== id.toLowerCase());
    if (this.users.length < initialLen) {
      this.saveToFile(this.users);
      return true;
    }
    return false;
  }
}

export const userRepository = new UserRepository();
