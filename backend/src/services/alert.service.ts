import { config } from '../config/index.js';
import { alertRepository } from '../repositories/alert.repository.js';
import {
  AlertHistoryResponse,
  LatestAlertResponse,
  MonitoringAlert,
} from '../models/alert.model.js';

const UUID_PNG_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/i;

function normalizeEvidenceUrl(evidenceUrl: string | null | undefined): string | null {
  if (!evidenceUrl) return null;
  if (evidenceUrl.startsWith('/v1/evidence/')) {
    return `/api/v1/evidence/${evidenceUrl.slice('/v1/evidence/'.length)}`;
  }
  return evidenceUrl;
}

function normalizeAlert(alert: MonitoringAlert): MonitoringAlert {
  return {
    ...alert,
    evidenceUrl: normalizeEvidenceUrl(alert.evidenceUrl),
  };
}

export class AlertService {
  private readonly upstreamBase = config.aiServiceUrl;
  private syncing: Promise<void> | null = null;
  private context = { cameraId: '', sessionId: null as string | null, pipelineState: 'IDLE' as AlertHistoryResponse['pipelineState'] };
  public ingestionStatus = { available: false, lastSuccessAt: null as string | null, error: null as string | null };

  private async getUpstreamLatest(): Promise<LatestAlertResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(`${this.upstreamBase}/v1/alerts/latest`, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`UPSTREAM_ERROR_${response.status}`);
      }

      const data = (await response.json()) as LatestAlertResponse;
      return {
        ...data,
        alert: data.alert ? normalizeAlert(data.alert) : null,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('ALERT_UPSTREAM_TIMEOUT');
      }
      throw new Error(err.message || 'ALERT_UPSTREAM_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getUpstreamHistory(limit?: number): Promise<AlertHistoryResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const url = limit
        ? `${this.upstreamBase}/v1/alerts?limit=${encodeURIComponent(limit)}`
        : `${this.upstreamBase}/v1/alerts`;

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`UPSTREAM_ERROR_${response.status}`);
      }

      const data = (await response.json()) as AlertHistoryResponse;
      return {
        ...data,
        alerts: Array.isArray(data.alerts)
          ? data.alerts.map((alt) => normalizeAlert(alt))
          : [],
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('ALERT_UPSTREAM_TIMEOUT');
      }
      throw new Error(err.message || 'ALERT_UPSTREAM_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }

  public async getAlertById(id: string): Promise<MonitoringAlert | null> {
    await this.synchronize();
    return alertRepository.find(id);
  }

  public synchronize(): Promise<void> {
    if (this.syncing) return this.syncing;
    this.syncing = this.pullAlerts().finally(() => { this.syncing = null; });
    return this.syncing;
  }

  private async pullAlerts(): Promise<void> {
    try {
      const response = await fetch(`${this.upstreamBase}/v1/alerts/pending`, { signal: AbortSignal.timeout(4000) });
      // Compatibility while the existing AI process still runs the previous API.
      const hasPendingApi = response.status !== 404;
      if (hasPendingApi && !response.ok) throw new Error(`ALERT_UPSTREAM_${response.status}`);
      const data: AlertHistoryResponse = hasPendingApi ? await response.json() : await this.getUpstreamHistory();
      if (!Array.isArray(data.alerts)) throw new Error('INVALID_ALERT_RESPONSE');
      this.context = { cameraId: data.cameraId, sessionId: data.sessionId, pipelineState: data.pipelineState };
      const accepted: string[] = [];
      let incomplete = false;
      for (const raw of data.alerts) {
        const alert = normalizeAlert(raw);
        if (!alert.id || !alert.cameraId || !['fire', 'smoke'].includes(alert.class) || !Number.isFinite(Date.parse(alert.timestamp))) {
          throw new Error('INVALID_ALERT_RESPONSE');
        }
        if (alert.evidenceUrl) {
          const filename = alert.evidenceUrl.split('/').at(-1)!;
          if (!alertRepository.readEvidence(filename)) {
            const result = await this.fetchEvidence(filename);
            if (!result.ok || !result.buffer) { incomplete = true; continue; }
            alertRepository.saveEvidence(filename, result.buffer);
          }
        }
        alertRepository.save(alert);
        accepted.push(alert.id);
      }
      if (hasPendingApi && accepted.length) {
        const acknowledged = await fetch(`${this.upstreamBase}/v1/alerts/acknowledge`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: accepted }), signal: AbortSignal.timeout(4000),
        });
        if (!acknowledged.ok) throw new Error('ALERT_ACKNOWLEDGEMENT_FAILED');
      }
      if (incomplete) throw new Error('ALERT_EVIDENCE_UNAVAILABLE');
      this.ingestionStatus = { available: true, lastSuccessAt: new Date().toISOString(), error: null };
    } catch (error: any) {
      this.ingestionStatus = { ...this.ingestionStatus, available: false, error: error.message || 'ALERT_UPSTREAM_UNAVAILABLE' };
      // Saved Backend history remains readable during AI outages; pending deliveries are retried.
    }
  }

  public async getLatestAlert(): Promise<LatestAlertResponse> {
    await this.synchronize();
    try {
      const data = await this.getUpstreamLatest();
      this.context = { cameraId: data.cameraId, sessionId: data.sessionId, pipelineState: data.pipelineState };
      return { ...data, alert: data.alert ? alertRepository.find(data.alert.id) : null };
    } catch {
      const latest = alertRepository.list(1)[0] || null;
      return { ...this.context, pipelineState: 'FAILED', alert: latest };
    }
  }

  public async getAlertHistory(limit?: number): Promise<AlertHistoryResponse> {
    await this.synchronize();
    const count = alertRepository.list().length;
    return { ...this.context, pipelineState: this.ingestionStatus.available ? this.context.pipelineState : 'FAILED',
      retained: count, totalCreated: count, capacity: 100, alerts: alertRepository.list(limit) };
  }

  public async clearActiveAlert(alertId?: string, cameraId?: string): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(`${this.upstreamBase}/v1/alerts/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ alertId, cameraId }),
        signal: controller.signal,
      });
      if (!response.ok) return false;
      const data = (await response.json()) as { cleared?: boolean };
      return data.cleared === true;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  public async fetchEvidence(filename: string): Promise<{
    ok: boolean;
    status: number;
    contentType?: string;
    buffer?: ArrayBuffer;
  }> {
    if (!UUID_PNG_REGEX.test(filename)) {
      return { ok: false, status: 400 };
    }
    const saved = alertRepository.readEvidence(filename);
    if (saved) return { ok: true, status: 200, contentType: 'image/png', buffer: Uint8Array.from(saved).buffer };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(
        `${this.upstreamBase}/v1/evidence/${encodeURIComponent(filename)}`,
        {
          method: 'GET',
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        return { ok: false, status: response.status };
      }

      const contentType = response.headers.get('content-type') || 'image/png';
      const buffer = await response.arrayBuffer();

      return {
        ok: true,
        status: 200,
        contentType,
        buffer,
      };
    } catch {
      return { ok: false, status: 502 };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const alertService = new AlertService();
