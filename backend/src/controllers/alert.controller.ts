import { Request, Response } from 'express';
import { alertService } from '../services/alert.service.js';

export async function getLatestAlert(_req: Request, res: Response): Promise<void> {
  try {
    const data = await alertService.getLatestAlert();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  } catch (err: any) {
    res.status(502).json({
      error: 'ALERT_SERVICE_UNAVAILABLE',
      message: err.message || 'Không thể kết nối tới AI Pipeline',
    });
  }
}

export async function getAlertHistory(req: Request, res: Response): Promise<void> {
  try {
    const { limit } = req.query;
    let limitNum: number | undefined;

    if (limit !== undefined) {
      limitNum = Number(limit);
      if (!Number.isSafeInteger(limitNum) || limitNum < 1 || limitNum > 100) {
        res.status(400).json({
          error: 'INVALID_ALERT_QUERY',
          message: 'limit phải là số nguyên từ 1 đến 100',
        });
        return;
      }
    }

    const data = await alertService.getAlertHistory(limitNum);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  } catch (err: any) {
    res.status(502).json({
      error: 'ALERT_SERVICE_UNAVAILABLE',
      message: err.message || 'Không thể kết nối tới AI Pipeline',
    });
  }
}

export async function getAlertById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const alert = await alertService.getAlertById(id);

    if (!alert) {
      res.status(404).json({
        error: 'ALERT_NOT_FOUND',
        message: `Không tìm thấy cảnh báo với ID: ${id}`,
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(alert);
  } catch (err: any) {
    res.status(502).json({
      error: 'ALERT_SERVICE_UNAVAILABLE',
      message: err.message || 'Không thể kết nối tới AI Pipeline',
    });
  }
}

export async function clearAlert(req: Request, res: Response): Promise<void> {
  try {
    const { alertId, cameraId } = req.body || {};
    const cleared = await alertService.clearActiveAlert(alertId, cameraId);
    res.status(200).json({ success: true, cleared });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

