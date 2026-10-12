export type UserRole = 'ADMIN' | 'MANAGER' | 'SECURITY';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastActive: string;
  avatarUrl?: string;
}
