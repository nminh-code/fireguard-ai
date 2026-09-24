import { User, UserRole } from '../types';
import { INITIAL_USERS } from './mockData';
import { realtimeService } from './realtimeService';

class AuthService {
  private users: User[] = [...INITIAL_USERS];
  private currentUser: User = { ...INITIAL_USERS[0] }; // Default: ADMIN (Vũ Diễm)
  private authenticated: boolean = localStorage.getItem('favis_auth_token') === 'true';
  private listeners: Set<(user: User | null) => void> = new Set();

  constructor() {
    const storedEmail = localStorage.getItem('favis_current_user_email');
    if (storedEmail) {
      const found = this.users.find((u) => u.email.toLowerCase() === storedEmail.toLowerCase());
      if (found) {
        this.currentUser = { ...found };
      }
    }
  }

  public isLoggedIn(): boolean {
    return this.authenticated;
  }

  public getCurrentUser(): User {
    return this.currentUser;
  }

  public login(email: string, password?: string): { success: boolean; message?: string; user?: User } {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      return { success: false, message: 'Vui lòng nhập Email hoặc tên đăng nhập!' };
    }

    const found = this.users.find(
      (u) => u.email.toLowerCase() === trimmed || u.name.toLowerCase() === trimmed
    );

    if (found) {
      this.currentUser = { ...found, lastActive: 'Đang trực tuyến' };
      this.authenticated = true;
      localStorage.setItem('favis_auth_token', 'true');
      localStorage.setItem('favis_current_user_email', found.email);
      this.notifyListeners();
      realtimeService.dispatchAuthEvent(this.currentUser);
      return { success: true, user: this.currentUser };
    }

    // Auto-create user for demo login if email format is entered
    const newUser: User = {
      id: `usr-${Date.now().toString().slice(-4)}`,
      name: email.split('@')[0] || email,
      email: email.includes('@') ? email : `${email}@favis.vn`,
      role: 'ADMIN',
      status: 'ACTIVE',
      lastActive: 'Đang trực tuyến',
    };

    this.users.push(newUser);
    this.currentUser = newUser;
    this.authenticated = true;
    localStorage.setItem('favis_auth_token', 'true');
    localStorage.setItem('favis_current_user_email', newUser.email);
    this.notifyListeners();
    realtimeService.dispatchAuthEvent(this.currentUser);

    return { success: true, user: this.currentUser };
  }

  public register(
    name: string,
    email: string,
    role: UserRole = 'SECURITY',
    phone: string = ''
  ): { success: boolean; message?: string; user?: User } {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      return { success: false, message: 'Vui lòng nhập họ và tên!' };
    }
    if (!trimmedEmail) {
      return { success: false, message: 'Vui lòng nhập địa chỉ Email!' };
    }

    const exists = this.users.some((u) => u.email.toLowerCase() === trimmedEmail);
    if (exists) {
      return { success: false, message: 'Email này đã tồn tại trong hệ thống Favis AI!' };
    }

    const newUser: User = {
      id: `usr-${Date.now().toString().slice(-4)}`,
      name: trimmedName,
      email: trimmedEmail,
      role: role,
      phone: phone.trim(),
      status: 'ACTIVE',
      lastActive: 'Đang trực tuyến',
    };

    this.users.push(newUser);
    this.currentUser = newUser;
    this.authenticated = true;
    localStorage.setItem('favis_auth_token', 'true');
    localStorage.setItem('favis_current_user_email', newUser.email);
    this.notifyListeners();
    realtimeService.dispatchAuthEvent(this.currentUser);

    return { success: true, user: newUser };
  }

  public logout(): void {
    this.authenticated = false;
    localStorage.removeItem('favis_auth_token');
    localStorage.removeItem('favis_current_user_email');
    this.notifyListeners();
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
    const wrapper = (u: User | null) => {
      if (u) cb(u);
    };
    this.listeners.add(wrapper);
    return () => {
      this.listeners.delete(wrapper);
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
  public hasPermission(
    role: UserRole,
    permission:
      | 'ADMIN_PANEL'
      | 'RESOLVE_INCIDENT'
      | 'START_RESPONSE'
      | 'CAMERA_CONTROL'
      | 'EDIT_SETTINGS'
  ): boolean {
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
