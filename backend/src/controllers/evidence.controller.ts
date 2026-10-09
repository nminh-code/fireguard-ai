import { Request, Response } from 'express';
import { alertService } from '../services/alert.service.js';

export async function getEvidence(req: Request, res: Response): Promise<void> {
  try {
    const { file } = req.params;
    const result = await alertService.fetchEvidence(file);

    if (!result.ok || !result.buffer) {
      res.status(result.status || 404).json({
        error: 'EVIDENCE_NOT_FOUND',
        message: 'Không tìm thấy file ảnh bằng chứng',
      });
      return;
    }

    res.setHeader('Content-Type', result.contentType || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(Buffer.from(result.buffer));
  } catch (err: any) {
    res.status(502).json({
      error: 'EVIDENCE_PROXY_ERROR',
      message: err.message || 'Lỗi khi tải ảnh bằng chứng',
    });
  }
}
