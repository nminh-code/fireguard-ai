import { Request, Response } from 'express';
import { siteService } from '../services/site.service.js';

// --- Site & Zones Controllers ---

export async function getSite(_req: Request, res: Response): Promise<void> {
  try {
    const data = await siteService.getSite();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      data,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi lấy thông tin Site' },
    });
  }
}

export async function getZones(_req: Request, res: Response): Promise<void> {
  try {
    const data = await siteService.getZones();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      data,
      count: data.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi lấy danh sách phân khu (Zones)' },
    });
  }
}

export async function addZone(req: Request, res: Response): Promise<void> {
  try {
    const { name, code, area, description, coordinates, cameraIds } = req.body || {};

    if (!name || !code || !area) {
      res.status(400).json({
        success: false,
        error: { message: 'Thiếu các trường bắt buộc của phân khu: name, code, area' },
      });
      return;
    }

    const created = await siteService.addZone({
      name,
      code,
      area,
      description: description || '',
      coordinates: coordinates || { x: 0, y: 0, width: 10, height: 10 },
      cameraIds: Array.isArray(cameraIds) ? cameraIds : [],
    });

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi thêm phân khu mới' },
    });
  }
}

export async function updateZone(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      res.status(400).json({
        success: false,
        error: { message: 'ID phân khu không hợp lệ' },
      });
      return;
    }

    const updated = await siteService.updateZone(id, req.body || {});
    if (!updated) {
      res.status(404).json({
        success: false,
        error: { message: `Không tìm thấy phân khu với ID: ${id}` },
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
      error: { message: err.message || 'Lỗi khi cập nhật phân khu' },
    });
  }
}

export async function deleteZone(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      res.status(400).json({
        success: false,
        error: { message: 'ID phân khu không hợp lệ' },
      });
      return;
    }

    const deleted = await siteService.deleteZone(id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { message: `Không tìm thấy phân khu để xóa: ${id}` },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { message: 'Đã xóa phân khu thành công', id },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi xóa phân khu' },
    });
  }
}

// --- System Settings Controllers ---

export async function getSettings(_req: Request, res: Response): Promise<void> {
  try {
    const data = await siteService.getSettings();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      data,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi lấy cấu hình hệ thống' },
    });
  }
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      res.status(400).json({
        success: false,
        error: { message: 'Dữ liệu cấu hình cập nhật không hợp lệ' },
      });
      return;
    }

    // Validation for detection thresholds
    if (updates.detectionThreshold !== undefined) {
      const val = Number(updates.detectionThreshold);
      if (isNaN(val) || val < 0 || val > 100) {
        res.status(400).json({
          success: false,
          error: { message: 'Ngưỡng phát hiện lửa (detectionThreshold) phải từ 0 đến 100%' },
        });
        return;
      }
    }

    if (updates.smokeThreshold !== undefined) {
      const val = Number(updates.smokeThreshold);
      if (isNaN(val) || val < 0 || val > 100) {
        res.status(400).json({
          success: false,
          error: { message: 'Ngưỡng phát hiện khói (smokeThreshold) phải từ 0 đến 100%' },
        });
        return;
      }
    }

    const updated = await siteService.updateSettings(updates);
    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi cập nhật cấu hình hệ thống' },
    });
  }
}
