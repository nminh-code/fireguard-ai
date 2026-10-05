import { Incident, IncidentStatus, DashboardStats, FireEvent, IncidentTimeline, Camera } from '../types';
import { cameraConnectionService } from './cameraConnectionService';
import { cameraSessionStore } from './cameraSessionStore';
import { realtimeService } from './realtimeService';
import { notificationService } from './notificationService';
import { getAlertHistory, MonitoringAlert, evidenceHref } from './monitoringAlertService';

class IncidentService {
  private incidents: Incident[] = [];
  private historyEvents: FireEvent[] = [];
  private syncedAlertIds = new Set<string>();

  constructor() {
    this.syncWithRealAlerts();
  }

  /**
   * Synchronize incidents and history with real camera detections from monitoring API
   */
  public async syncWithRealAlerts(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const data = await getAlertHistory(controller.signal);
      clearTimeout(timeout);

      if (data && data.alerts && data.alerts.length > 0) {
        data.alerts.forEach((alert) => {
          if (!this.syncedAlertIds.has(alert.id)) {
            this.syncedAlertIds.add(alert.id);
            // Only fire detections generate real incidents; smoke alerts are ignored for incidents
            if (alert.class === 'fire') {
              this.createIncidentFromRealAlert(alert);
            }
          }
        });
      }
    } catch {
      // Backend not reached, keep existing state
    }
  }

  private createIncidentFromRealAlert(alert: MonitoringAlert): Incident | null {
    if (alert.class !== 'fire') {
      return null;
    }
    const savedCams = cameraConnectionService.getSavedCameras();
    const activeStream = cameraSessionStore.getSnapshot().activeStream;

    const savedMatch = savedCams.find((c) => c.id === alert.cameraId);
    const cameraName =
      savedMatch?.name ||
      (activeStream?.cameraId === alert.cameraId ? activeStream.cameraName : `Camera ${alert.cameraId}`);
    const location = savedMatch?.brand
      ? `${savedMatch.brand} • ${savedMatch.ip}`
      : 'Khu vực giám sát camera';

    const incidentId = `inc-${alert.id.substring(0, 8)}`;
    const incidentCode = `FG-${new Date().getFullYear()}-${alert.sequence.toString().padStart(3, '0')}`;
    const timeStr = new Date(alert.timestamp).toLocaleTimeString('vi-VN', { hour12: false });

    const newIncident: Incident = {
      id: incidentId,
      code: incidentCode,
      cameraId: alert.cameraId,
      cameraCode: alert.cameraId,
      siteId: 'site-real',
      location: `${cameraName} (${location})`,
      eventType: 'FIRE_CONFIRMED',
      fireConfidence: Math.round(alert.confidence * 100),
      smokeConfidence: 0,
      severity: alert.confidence >= 0.85 ? 'HIGH' : 'MEDIUM',
      status: 'ACTIVE',
      detectedAt: timeStr,
      snapshotUrl: alert.evidenceUrl ? evidenceHref(alert.evidenceUrl) : undefined,
      timeline: [
        {
          id: `tl-${Date.now()}-1`,
          time: timeStr,
          title: `AI phát hiện FIRE từ camera ${cameraName}`,
          description: `Mô hình AI phát hiện ngọn lửa với độ tin cậy ${(alert.confidence * 100).toFixed(1)}%. Sequence #${alert.sequence}.`,
          type: 'DETECTED',
          actor: 'Favis Edge AI Engine',
        },
      ],
      notes: `Phát hiện tự động bởi hệ thống AI Vision trên camera ${cameraName}.`,
    };

    this.incidents.unshift(newIncident);

    this.historyEvents.unshift({
      id: `evt-${alert.id}`,
      eventType: 'FIRE_CONFIRMED',
      cameraId: alert.cameraId,
      cameraCode: alert.cameraId,
      location: `${cameraName} (${location})`,
      severity: newIncident.severity,
      timestamp: timeStr,
      status: 'ACTIVE',
      details: `Phát hiện ${alert.class.toUpperCase()} (Độ tin cậy: ${(alert.confidence * 100).toFixed(1)}%)`,
    });

    realtimeService.dispatchIncident(newIncident);
    return newIncident;
  }

  public async getIncidents(): Promise<Incident[]> {
    await this.syncWithRealAlerts();
    return [...this.incidents];
  }

  public async getIncident(id: string): Promise<Incident | null> {
    await this.syncWithRealAlerts();
    const inc = this.incidents.find((i) => i.id === id || i.code.toLowerCase() === id.toLowerCase());
    return inc ? { ...inc } : null;
  }

  public async getHistory(): Promise<FireEvent[]> {
    await this.syncWithRealAlerts();
    return [...this.historyEvents];
  }

  public async getDashboardStats(): Promise<DashboardStats> {
    await this.syncWithRealAlerts();
    const saved = cameraConnectionService.getSavedCameras();
    const activeStream = cameraSessionStore.getSnapshot().activeStream;

    const totalCameras = saved.length + (activeStream && !saved.some((c) => c.id === activeStream.cameraId) ? 1 : 0);
    const onlineCount = activeStream?.connected ? 1 : 0;
    const offlineCount = Math.max(0, totalCameras - onlineCount);

    const activeIncidents = this.incidents.filter(
      (i) => i.status === 'ACTIVE' || i.status === 'RESPONDING'
    );

    const latestActive = activeIncidents[0] || (this.incidents.length > 0 ? this.incidents[0] : null);
    const systemStatus = activeIncidents.length > 0 ? 'CRITICAL' : offlineCount > 0 ? 'WARNING' : 'OPERATIONAL';

    return {
      totalCameras,
      camerasOnline: onlineCount,
      camerasOffline: offlineCount,
      activeIncidents: activeIncidents.length,
      todayEventsCount: this.historyEvents.length,
      systemStatus,
      lastIncident: latestActive,
    };
  }

  public async startResponse(id: string, responderName = 'Nhân viên an ninh'): Promise<Incident | null> {
    const incident = this.incidents.find((i) => i.id === id || i.code === id);
    if (!incident) return null;

    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    incident.status = 'RESPONDING';
    incident.responseStartedAt = nowStr;
    incident.responseStartedBy = responderName;

    const timelineItem: IncidentTimeline = {
      id: `tl-${Date.now()}`,
      time: nowStr,
      title: 'Kích hoạt lực lượng phản ứng tại chỗ',
      description: `${responderName} đã chuyển trạng thái sang ĐANG XỬ LÝ (RESPONDING). Đội PCCC cơ sở đang tiếp cận hiện trường.`,
      type: 'RESPONDING',
      actor: responderName,
    };
    incident.timeline.push(timelineItem);

    this.historyEvents.unshift({
      id: `evt-${Date.now()}`,
      eventType: 'FIRE_CONFIRMED',
      cameraId: incident.cameraId,
      cameraCode: incident.cameraCode,
      location: incident.location,
      severity: incident.severity,
      timestamp: nowStr,
      status: 'RESPONDING',
      details: `${responderName} bắt đầu triển khai xử lý tại ${incident.location}`,
    });

    realtimeService.dispatchIncident(incident);
    return { ...incident };
  }

  public async resolveIncident(
    id: string,
    resolverName = 'Nguyễn Văn A',
    notes = 'Đám cháy đã được kiểm soát hoàn toàn, không có thiệt hại về người.'
  ): Promise<Incident | null> {
    const incident = this.incidents.find((i) => i.id === id || i.code === id);
    if (!incident) return null;

    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    incident.status = 'RESOLVED';
    incident.resolvedAt = nowStr;
    incident.resolvedBy = resolverName;
    if (notes) {
      incident.notes = notes;
    }

    const timelineItem: IncidentTimeline = {
      id: `tl-${Date.now()}`,
      time: nowStr,
      title: 'Sự cố đã được giải quyết thành công',
      description: `${resolverName} đã kiểm tra hiện trường và đánh dấu ĐÃ XỬ LÝ (RESOLVED). ${notes}`,
      type: 'RESOLVED',
      actor: resolverName,
    };
    incident.timeline.push(timelineItem);

    notificationService.addNotification({
      type: 'INCIDENT_UPDATE',
      title: '✅ SỰ CỐ ĐÃ ĐƯỢC XỬ LÝ',
      message: `Sự cố #${incident.code} tại ${incident.location} đã được xử lý bởi ${resolverName}.`,
      location: incident.location,
      cameraCode: incident.cameraCode,
      incidentId: incident.id,
      severity: 'LOW',
    });

    this.historyEvents.unshift({
      id: `evt-${Date.now()}`,
      eventType: 'INCIDENT_RESOLVED',
      cameraId: incident.cameraId,
      cameraCode: incident.cameraCode,
      location: incident.location,
      severity: 'LOW',
      timestamp: nowStr,
      status: 'RESOLVED',
      details: `Sự cố ${incident.code} được giải quyết bởi ${resolverName}`,
    });

    realtimeService.dispatchIncident(incident);
    return { ...incident };
  }

  public async markFalseAlarm(
    id: string,
    actorName = 'Trần Văn Mạnh',
    reason = 'Báo động giả do luồng hơi nhiệt'
  ): Promise<Incident | null> {
    const incident = this.incidents.find((i) => i.id === id || i.code === id);
    if (!incident) return null;

    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    incident.status = 'FALSE_ALARM';
    incident.resolvedAt = nowStr;
    incident.resolvedBy = actorName;
    incident.notes = `Báo động giả: ${reason}`;

    incident.timeline.push({
      id: `tl-${Date.now()}`,
      time: nowStr,
      title: 'Xác nhận Báo Động Giả (FALSE ALARM)',
      description: `${actorName} đã kiểm tra trực tiếp qua camera và hiện trường. Lý do: ${reason}.`,
      type: 'FALSE_ALARM',
      actor: actorName,
    });

    this.historyEvents.unshift({
      id: `evt-${Date.now()}`,
      eventType: 'FALSE_ALARM',
      cameraId: incident.cameraId,
      cameraCode: incident.cameraCode,
      location: incident.location,
      severity: 'LOW',
      timestamp: nowStr,
      status: 'FALSE_ALARM',
      details: `Báo động giả tại ${incident.location}: ${reason}`,
    });

    realtimeService.dispatchIncident(incident);
    return { ...incident };
  }

  public simulateFireEvent(): Incident {
    const activeStream = cameraSessionStore.getSnapshot().activeStream;
    const saved = cameraConnectionService.getSavedCameras();

    const camId = activeStream?.cameraId || saved[0]?.id || 'camera-01';
    const camName = activeStream?.cameraName || saved[0]?.name || 'Camera Live';
    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });

    const newInc: Incident = {
      id: `inc-${Date.now()}`,
      code: `FG-${new Date().getFullYear()}-${(this.incidents.length + 1).toString().padStart(3, '0')}`,
      cameraId: camId,
      cameraCode: camId,
      siteId: 'site-real',
      location: camName,
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
          title: `AI phát hiện đám cháy trên ${camName}`,
          description: `Mô hình phát hiện ngọn lửa với độ tin cậy 94%.`,
          type: 'DETECTED',
          actor: 'Favis AI Engine',
        },
      ],
      notes: `Sự cố phát hiện trên camera thực tế ${camName}.`,
    };

    this.incidents.unshift(newInc);
    this.historyEvents.unshift({
      id: `evt-${Date.now()}`,
      eventType: 'FIRE_CONFIRMED',
      cameraId: camId,
      cameraCode: camId,
      location: camName,
      severity: 'CRITICAL',
      timestamp: nowStr,
      status: 'ACTIVE',
      details: `Phát hiện đám cháy độ tin cậy 94% trên ${camName}`,
    });

    realtimeService.dispatchIncident(newInc);
    return newInc;
  }

  public resolveLatestActiveIncident(resolverName = 'Vũ Diễm'): Incident | null {
    const active = this.incidents.find((i) => i.status === 'ACTIVE' || i.status === 'RESPONDING');
    if (!active) return null;
    this.resolveIncident(active.id, resolverName);
    return active;
  }
}

export const incidentService = new IncidentService();
