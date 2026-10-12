import { User, UserRole } from '../models/user.model.js';
import { userRepository } from '../repositories/user.repository.js';

export class UserService {
  public async getAllUsers(): Promise<User[]> {
    return userRepository.findAll();
  }

  public async getUserById(id: string): Promise<User | null> {
    return userRepository.findById(id);
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    return userRepository.findByEmail(email);
  }

  public async createUser(data: {
    name: string;
    email: string;
    role: UserRole;
    phone?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    id?: string;
    lastActive?: string;
    avatarUrl?: string;
  }): Promise<User> {
    const trimmedEmail = data.email.trim().toLowerCase();
    const existing = await userRepository.findByEmail(trimmedEmail);
    if (existing) {
      return existing;
    }

    const newUser: User = {
      id: data.id || `usr-${Date.now().toString().slice(-4)}`,
      name: data.name.trim(),
      email: trimmedEmail,
      role: data.role,
      phone: data.phone?.trim() || '',
      status: data.status || 'ACTIVE',
      lastActive: data.lastActive || 'Chưa đăng nhập',
      avatarUrl: data.avatarUrl,
    };

    return userRepository.create(newUser);
  }

  public async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    return userRepository.update(id, updates);
  }

  public async deleteUser(id: string): Promise<boolean> {
    return userRepository.delete(id);
  }
}

export const userService = new UserService();
