import { Request, Response } from 'express';
import { incidentService } from '../services/incident.service.js';

export async function getAllIncidents(_req: Request, res: Response): Promise<void> {
  try {
    const data = await incidentService.getIncidents();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      data,
      count: data.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi lấy danh sách sự cố' },
    });
  }
}

export async function getIncidentById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const incident = await incidentService.getIncidentById(id);

    if (!incident) {
      res.status(404).json({
        success: false,
        error: { message: `Không tìm thấy sự cố với ID: ${id}` },
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      data: incident,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi lấy chi tiết sự cố' },
    });
  }
}

export async function getDashboardStats(_req: Request, res: Response): Promise<void> {
  try {
    const stats = await incidentService.getDashboardStats();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi tính toán thống kê KPI' },
    });
  }
}

export async function getHistory(_req: Request, res: Response): Promise<void> {
  try {
    const history = await incidentService.getHistory();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi lấy nhật ký lịch sử' },
    });
  }
}

export async function startResponse(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { responderName } = req.body || {};
    const updated = await incidentService.startResponse(id, responderName);

    if (!updated) {
      res.status(404).json({
        success: false,
        error: { message: `Không tìm thấy sự cố để xử lý: ${id}` },
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
      error: { message: err.message || 'Lỗi khi bắt đầu xử lý sự cố' },
    });
  }
}

export async function resolveIncident(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { resolverName, notes } = req.body || {};
    const updated = await incidentService.resolveIncident(id, resolverName, notes);

    if (!updated) {
      res.status(404).json({
        success: false,
        error: { message: `Không tìm thấy sự cố để giải quyết: ${id}` },
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
      error: { message: err.message || 'Lỗi khi đánh dấu giải quyết sự cố' },
    });
  }
}

export async function markFalseAlarm(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { actorName, reason } = req.body || {};
    const updated = await incidentService.markFalseAlarm(id, actorName, reason);

    if (!updated) {
      res.status(404).json({
        success: false,
        error: { message: `Không tìm thấy sự cố để đánh dấu báo động giả: ${id}` },
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
      error: { message: err.message || 'Lỗi khi đánh dấu báo động giả' },
    });
  }
}

export async function simulateFireEvent(_req: Request, res: Response): Promise<void> {
  try {
    const simulated = await incidentService.simulateFireEvent();
    res.status(201).json({
      success: true,
      data: simulated,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Lỗi khi tạo sự cố mô phỏng' },
    });
  }
}
