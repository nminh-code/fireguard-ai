import {
  Incident,
  DashboardStats,
  FireEvent,
  IncidentTimeline,
} from '../types';
import { realtimeService } from './realtimeService';
import { notificationService } from './notificationService';

const BACKEND_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

class IncidentService {
  private incidentsCache: Incident[] = [];
  private historyCache: FireEvent[] = [];

  public async getIncidents(): Promise<Incident[]> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/incidents`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          this.incidentsCache = json.data;
          return [...this.incidentsCache];
        }
      }
    } catch {
      // Backend unavailable, return cached
    }
    return [...this.incidentsCache];
  }

  public async getIncident(id: string): Promise<Incident | null> {
    try {
      const res = await fetch(
        `${BACKEND_BASE_URL}/incidents/${encodeURIComponent(id)}`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const inc: Incident = json.data;
          const idx = this.incidentsCache.findIndex((i) => i.id === inc.id);
          if (idx >= 0) this.incidentsCache[idx] = inc;
          else this.incidentsCache.unshift(inc);
          return { ...inc };
        }
      }
    } catch {
      // Backend unavailable, fallback search in cache
    }

    const found = this.incidentsCache.find(
      (i) => i.id.toLowerCase() === id.toLowerCase() || i.code.toLowerCase() === id.toLowerCase()
    );
    return found ? { ...found } : null;
  }

  public async getHistory(): Promise<FireEvent[]> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/incidents/history`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          this.historyCache = json.data;
          return [...this.historyCache];
        }
      }
    } catch {
      // Fallback
    }
    return [...this.historyCache];
  }

  public async getDashboardStats(): Promise<DashboardStats> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/incidents/stats`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch {
      // Fallback calculation from local caches
    }

    const activeIncidents = this.incidentsCache.filter(
      (i) => i.status === 'ACTIVE' || i.status === 'RESPONDING'
    );
    return {
      totalCameras: 24,
      camerasOnline: 23,
      camerasOffline: 1,
      activeIncidents: activeIncidents.length,
      todayEventsCount: this.historyCache.length,
      systemStatus: activeIncidents.length > 0 ? 'CRITICAL' : 'OPERATIONAL',
      lastIncident: activeIncidents[0] || this.incidentsCache[0] || null,
    };
  }

  public async startResponse(
    id: string,
    responderName = 'Nhân viên an ninh'
  ): Promise<Incident | null> {
    try {
      const res = await fetch(
        `${BACKEND_BASE_URL}/incidents/${encodeURIComponent(id)}/start-response`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responderName }),
        }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const updated: Incident = json.data;
          const idx = this.incidentsCache.findIndex((i) => i.id === id || i.code === id);
          if (idx >= 0) this.incidentsCache[idx] = updated;
          realtimeService.dispatchIncident(updated);
          return { ...updated };
        }
      }
    } catch {
      // Fallback local update
    }

    const incident = this.incidentsCache.find((i) => i.id === id || i.code === id);
    if (!incident) return null;

    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    incident.status = 'RESPONDING';
    incident.responseStartedAt = nowStr;
    incident.responseStartedBy = responderName;

    const timelineItem: IncidentTimeline = {
      id: `tl-${Date.now()}`,
      time: nowStr,
      title: 'Kích hoạt lực lượng phản ứng tại chỗ',
      description: `${responderName} đã chuyển trạng thái sang ĐANG XỬ LÝ (RESPONDING).`,
      type: 'RESPONDING',
      actor: responderName,
    };
    incident.timeline.push(timelineItem);
    realtimeService.dispatchIncident(incident);
    return { ...incident };
  }

  public async resolveIncident(
    id: string,
    resolverName = 'Nguyễn Văn A',
    notes = 'Đám cháy đã được kiểm soát hoàn toàn, không có thiệt hại về người.'
  ): Promise<Incident | null> {
    try {
      const res = await fetch(
        `${BACKEND_BASE_URL}/incidents/${encodeURIComponent(id)}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolverName, notes }),
        }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const updated: Incident = json.data;
          const idx = this.incidentsCache.findIndex((i) => i.id === id || i.code === id);
          if (idx >= 0) this.incidentsCache[idx] = updated;

          notificationService.addNotification({
            type: 'INCIDENT_UPDATE',
            title: '✅ SỰ CỐ ĐÃ ĐƯỢC XỬ LÝ',
            message: `Sự cố #${updated.code} tại ${updated.location} đã được xử lý bởi ${resolverName}.`,
            location: updated.location,
            cameraCode: updated.cameraCode,
            incidentId: updated.id,
            severity: 'LOW',
          });

          realtimeService.dispatchIncident(updated);
          return { ...updated };
        }
      }
    } catch {
      // Fallback
    }

    const incident = this.incidentsCache.find((i) => i.id === id || i.code === id);
    if (!incident) return null;

    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    incident.status = 'RESOLVED';
    incident.resolvedAt = nowStr;
    incident.resolvedBy = resolverName;
    if (notes) incident.notes = notes;

    realtimeService.dispatchIncident(incident);
    return { ...incident };
  }

  public async markFalseAlarm(
    id: string,
    actorName = 'Trần Văn Mạnh',
    reason = 'Báo động giả do luồng hơi nhiệt'
  ): Promise<Incident | null> {
    try {
      const res = await fetch(
        `${BACKEND_BASE_URL}/incidents/${encodeURIComponent(id)}/false-alarm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actorName, reason }),
        }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const updated: Incident = json.data;
          const idx = this.incidentsCache.findIndex((i) => i.id === id || i.code === id);
          if (idx >= 0) this.incidentsCache[idx] = updated;
          realtimeService.dispatchIncident(updated);
          return { ...updated };
        }
      }
    } catch {
      // Fallback
    }

    const incident = this.incidentsCache.find((i) => i.id === id || i.code === id);
    if (!incident) return null;

    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    incident.status = 'FALSE_ALARM';
    incident.resolvedAt = nowStr;
    incident.resolvedBy = actorName;
    incident.notes = `Báo động giả: ${reason}`;

    realtimeService.dispatchIncident(incident);
    return { ...incident };
  }

  public async simulateFireEvent(): Promise<Incident> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/incidents/simulate`, {
        method: 'POST',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const newInc: Incident = json.data;
          this.incidentsCache.unshift(newInc);
          realtimeService.dispatchIncident(newInc);
          return newInc;
        }
      }
    } catch {
      // Fallback
    }

    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    const fallbackInc: Incident = {
      id: `inc-${Date.now()}`,
      code: `FG-${new Date().getFullYear()}-${(this.incidentsCache.length + 1).toString().padStart(3, '0')}`,
      cameraId: 'cam-08',
      cameraCode: 'CAM-08',
      siteId: 'site-real',
      location: 'Kho nguyên liệu A',
      eventType: 'FIRE_CONFIRMED',
      fireConfidence: 94,
      smokeConfidence: 91,
      severity: 'CRITICAL',
      status: 'ACTIVE',
      detectedAt: nowStr,
      timeline: [
        {
          id: `tl-${Date.now()}-1`,
          time: nowStr,
          title: 'AI phát hiện đám cháy',
          description: 'Mô hình phát hiện ngọn lửa với độ tin cậy 94%.',
          type: 'DETECTED',
          actor: 'Favis AI Engine',
        },
      ],
      notes: 'Sự cố phát hiện trên camera.',
    };

    this.incidentsCache.unshift(fallbackInc);
    realtimeService.dispatchIncident(fallbackInc);
    return fallbackInc;
  }

  public async resolveLatestActiveIncident(resolverName = 'Vũ Diễm'): Promise<Incident | null> {
    const list = await this.getIncidents();
    const active = list.find((i) => i.status === 'ACTIVE' || i.status === 'RESPONDING');
    if (!active) return null;
    return this.resolveIncident(active.id, resolverName);
  }
}

export const incidentService = new IncidentService();
