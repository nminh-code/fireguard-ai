import { Request, Response } from 'express';
import { cameraService } from '../services/camera.service.js';

export async function getAllCameras(req: Request, res: Response): Promise<void> {
  try {
    const { zoneId, status, search } = req.query;
    const cameras = await cameraService.getCameras({
      zoneId: typeof zoneId === 'string' ? zoneId : undefined,
      status: typeof status === 'string' ? (status as any) : undefined,
      search: typeof search === 'string' ? search : undefined,
    });

    res.status(200).json({
      success: true,
      data: cameras,
      count: cameras.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi lấy danh sách camera' },
    });
  }
}

export async function getCameraById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const camera = await cameraService.getCameraById(id);

    if (!camera) {
      res.status(404).json({
        success: false,
        error: { message: `Không tìm thấy camera với ID: ${id}` },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: camera,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi lấy thông tin camera' },
    });
  }
}

export async function createCamera(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body;
    if (!body || !body.name) {
      res.status(400).json({
        success: false,
        error: { message: 'Tên camera là bắt buộc' },
      });
      return;
    }

    const created = await cameraService.addCamera(body);
    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi tạo camera' },
    });
  }
}

export async function updateCamera(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = await cameraService.updateCamera(id, updates);
    if (!updated) {
      res.status(404).json({
        success: false,
        error: { message: `Không tìm thấy camera để cập nhật: ${id}` },
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
      error: { message: err.message || 'Lỗi khi cập nhật camera' },
    });
  }
}

export async function deleteCamera(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const success = await cameraService.deleteCamera(id);

    if (!success) {
      res.status(404).json({
        success: false,
        error: { message: `Không tìm thấy camera để xóa: ${id}` },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { id, deleted: true },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi xóa camera' },
    });
  }
}

// --- Connection Configs Controllers ---

export async function getSavedConfigs(_req: Request, res: Response): Promise<void> {
  try {
    const configs = await cameraService.getSavedConfigs();
    res.status(200).json({
      success: true,
      data: configs,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi lấy danh sách cấu hình camera' },
    });
  }
}

export async function saveConfig(req: Request, res: Response): Promise<void> {
  try {
    const config = req.body;
    if (!config || !config.id || !config.name) {
      res.status(400).json({
        success: false,
        error: { message: 'ID và Tên camera là bắt buộc' },
      });
      return;
    }

    const saved = await cameraService.saveConfig(config);
    res.status(200).json({
      success: true,
      data: saved,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi lưu cấu hình camera' },
    });
  }
}

export async function deleteConfig(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const success = await cameraService.deleteConfig(id);
    res.status(200).json({
      success,
      data: { id, deleted: success },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi xóa cấu hình camera' },
    });
  }
}

// --- Test & Status Controllers ---

export async function testConnection(req: Request, res: Response): Promise<void> {
  try {
    const config = req.body;
    const result = await cameraService.testConnection(config);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({
      status: 'FAILED',
      errorMessage: err.message || 'Lỗi khi kiểm tra kết nối camera',
    });
  }
}

export async function getCameraStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const status = await cameraService.getStreamStatus(id);
    res.status(200).json(status);
  } catch (err: any) {
    res.status(500).json({ status: 'NOT_CONNECTED', error: err.message });
  }
}

export async function disconnectCamera(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await cameraService.disconnectStream(id);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
