import { User, UserRole } from '../types';
import { INITIAL_USERS } from './mockData';
import { realtimeService } from './realtimeService';

class AuthService {
  private users: User[] = [...INITIAL_USERS];
  private currentUser: User = { ...INITIAL_USERS[0] }; // Default: ADMIN (Vũ Diễm)
  private listeners: Set<(user: User) => void> = new Set();

  public getCurrentUser(): User {
    return this.currentUser;
  }

  public switchRole(role: UserRole): User {
    const found = this.users.find((u) => u.role === role);
    if (found) {
      this.currentUser = { ...found };
    } else {
      this.currentUser = {
        ...this.currentUser,
        role,
      };
    }
    this.notifyListeners();
    realtimeService.dispatchAuthEvent(this.currentUser);
    return this.currentUser;
  }

  public subscribeCurrentUser(cb: (user: User) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => cb(this.currentUser));
  }

  public async getUsers(): Promise<User[]> {
    return [...this.users];
  }

  public async addUser(user: Omit<User, 'id' | 'lastActive'>): Promise<User> {
    const newUser: User = {
      ...user,
      id: `usr-${Date.now().toString().slice(-4)}`,
      lastActive: 'Chưa đăng nhập',
    };
    this.users.push(newUser);
    return newUser;
  }

  public async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    this.users[idx] = { ...this.users[idx], ...updates };
    if (this.currentUser.id === id) {
      this.currentUser = { ...this.users[idx] };
      this.notifyListeners();
    }
    return this.users[idx];
  }

  public async deleteUser(id: string): Promise<boolean> {
    const initialLen = this.users.length;
    this.users = this.users.filter((u) => u.id !== id);
    return this.users.length < initialLen;
  }

  // Permission helpers
  public hasPermission(role: UserRole, permission: 'ADMIN_PANEL' | 'RESOLVE_INCIDENT' | 'START_RESPONSE' | 'CAMERA_CONTROL' | 'EDIT_SETTINGS'): boolean {
    switch (permission) {
      case 'ADMIN_PANEL':
        return role === 'ADMIN';
      case 'EDIT_SETTINGS':
        return role === 'ADMIN';
      case 'RESOLVE_INCIDENT':
        return role === 'ADMIN' || role === 'MANAGER';
      case 'START_RESPONSE':
        return role === 'ADMIN' || role === 'MANAGER' || role === 'SECURITY';
      case 'CAMERA_CONTROL':
        return role === 'ADMIN' || role === 'MANAGER' || role === 'SECURITY';
      default:
        return false;
    }
  }
}

export const authService = new AuthService();
