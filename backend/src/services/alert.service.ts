import { config } from '../config/index.js';
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

  public async getLatestAlert(): Promise<LatestAlertResponse> {
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

  public async getAlertHistory(limit?: number): Promise<AlertHistoryResponse> {
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
    const history = await this.getAlertHistory();
    const found = history.alerts.find(
      (a) => a.id.toLowerCase() === id.toLowerCase()
    );
    return found || null;
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
