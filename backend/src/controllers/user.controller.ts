import { Request, Response } from 'express';
import { userService } from '../services/user.service.js';
import { UserRole } from '../models/user.model.js';

export async function getAllUsers(_req: Request, res: Response): Promise<void> {
  try {
    const data = await userService.getAllUsers();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      data,
      count: data.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi lấy danh sách người dùng' },
    });
  }
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: { message: 'ID người dùng không hợp lệ' },
      });
      return;
    }

    const user = await userService.getUserById(id);
    if (!user) {
      res.status(404).json({
        success: false,
        error: { message: `Không tìm thấy người dùng với ID: ${id}` },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi lấy thông tin người dùng' },
    });
  }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, role, phone, status, avatarUrl } = req.body || {};

    if (!name || !email || !role) {
      res.status(400).json({
        success: false,
        error: { message: 'Thiếu các trường bắt buộc: name, email, role' },
      });
      return;
    }

    const validRoles: UserRole[] = ['ADMIN', 'MANAGER', 'SECURITY'];
    if (!validRoles.includes(role)) {
      res.status(400).json({
        success: false,
        error: { message: `Vai trò không hợp lệ: ${role}. Cho phép: ${validRoles.join(', ')}` },
      });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const existing = await userService.getUserByEmail(trimmedEmail);
    if (existing) {
      res.status(400).json({
        success: false,
        error: { message: `Email ${trimmedEmail} đã tồn tại trong hệ thống` },
      });
      return;
    }

    const created = await userService.createUser({
      name: String(name).trim(),
      email: trimmedEmail,
      role,
      phone: phone ? String(phone).trim() : '',
      status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      avatarUrl,
    });

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi tạo người dùng mới' },
    });
  }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: { message: 'ID người dùng không hợp lệ' },
      });
      return;
    }

    const existing = await userService.getUserById(id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { message: `Không tìm thấy người dùng với ID: ${id}` },
      });
      return;
    }

    const updates = req.body || {};

    // If updating email, check duplicate against other users
    if (updates.email) {
      const trimmedEmail = String(updates.email).trim().toLowerCase();
      const duplicate = await userService.getUserByEmail(trimmedEmail);
      if (duplicate && duplicate.id.toLowerCase() !== id.toLowerCase()) {
        res.status(400).json({
          success: false,
          error: { message: `Email ${trimmedEmail} đã được sử dụng bởi tài khoản khác` },
        });
        return;
      }
      updates.email = trimmedEmail;
    }

    if (updates.role) {
      const validRoles: UserRole[] = ['ADMIN', 'MANAGER', 'SECURITY'];
      if (!validRoles.includes(updates.role)) {
        res.status(400).json({
          success: false,
          error: { message: `Vai trò không hợp lệ: ${updates.role}` },
        });
        return;
      }
    }

    const updated = await userService.updateUser(id, updates);
    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi cập nhật người dùng' },
    });
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: { message: 'ID người dùng không hợp lệ' },
      });
      return;
    }

    const deleted = await userService.deleteUser(id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { message: `Không tìm thấy người dùng để xóa: ${id}` },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { message: 'Đã xóa người dùng thành công', id },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi xóa người dùng' },
    });
  }
}
