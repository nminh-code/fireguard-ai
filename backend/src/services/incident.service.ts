import {
  Incident,
  IncidentTimeline,
  FireEvent,
  DashboardStats,
} from '../models/incident.model.js';
import { incidentRepository } from '../repositories/incident.repository.js';
import { cameraRepository } from '../repositories/camera.repository.js';
import { alertService } from './alert.service.js';
import { MonitoringAlert } from '../models/alert.model.js';

export class IncidentService {
  private syncedAlertIds = new Set<string>();

  /**
   * Synchronize incidents and history with real camera detections from monitoring API
   */
  public async syncWithRealAlerts(): Promise<void> {
    try {
      const data = await alertService.getAlertHistory(20);

      if (data && Array.isArray(data.alerts) && data.alerts.length > 0) {
        for (const alert of data.alerts) {
          // 1. Quick in-memory check
          if (this.syncedAlertIds.has(alert.id)) {
            continue;
          }

          // 2. Persistent storage check (survives backend restarts)
          const existing = await incidentRepository.findBySourceAlertId(alert.id);
          if (existing) {
            this.syncedAlertIds.add(alert.id);
            continue;
          }

          // Mark in memory as tracked
          this.syncedAlertIds.add(alert.id);

          // Only fire detections generate real incidents
          if (alert.class === 'fire') {
            await this.createIncidentFromRealAlert(alert);
          }
        }
      }
    } catch {
      // Upstream alert service not reached, keep existing state
    }
  }

  private async createIncidentFromRealAlert(alert: MonitoringAlert): Promise<Incident | null> {
    if (alert.class !== 'fire') return null;

    const savedCams = await cameraRepository.findAllConfigs();
    const savedMatch = savedCams.find((c) => c.id === alert.cameraId);
    const cameraName = savedMatch?.name || `Camera ${alert.cameraId}`;
    const location = savedMatch?.brand
      ? `${savedMatch.brand} • ${savedMatch.ip}`
      : 'Khu vực giám sát camera';

    // Full Alert ID used to prevent collision
    const incidentId = `inc-${alert.id}`;
    const incidentCode = `FG-${new Date().getFullYear()}-${alert.sequence.toString().padStart(3, '0')}`;
    const timeStr = new Date(alert.timestamp).toLocaleTimeString('vi-VN', { hour12: false });

    const newIncident: Incident = {
      id: incidentId,
      sourceAlertId: alert.id,
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
      snapshotUrl: alert.evidenceUrl || undefined,
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

    const savedIncident = await incidentRepository.createIncident(newIncident);

    await incidentRepository.addHistoryEvent({
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

    return savedIncident;
  }

  public async getIncidents(): Promise<Incident[]> {
    await this.syncWithRealAlerts();
    return incidentRepository.findAllIncidents();
  }

  public async getIncidentById(id: string): Promise<Incident | null> {
    await this.syncWithRealAlerts();
    return incidentRepository.findIncidentById(id);
  }

  public async getHistory(): Promise<FireEvent[]> {
    await this.syncWithRealAlerts();
    return incidentRepository.findAllHistoryEvents();
  }

  public async getDashboardStats(): Promise<DashboardStats> {
    await this.syncWithRealAlerts();
    const saved = await cameraRepository.findAllConfigs();
    const allCams = await cameraRepository.findAll();
    const incidents = await incidentRepository.findAllIncidents();
    const historyEvents = await incidentRepository.findAllHistoryEvents();

    const totalCameras = Math.max(saved.length, allCams.length);
    const camerasOnline = allCams.filter((c) => c.status === 'ONLINE').length;
    const camerasOffline = Math.max(0, totalCameras - camerasOnline);

    const activeIncidents = incidents.filter(
      (i) => i.status === 'ACTIVE' || i.status === 'RESPONDING'
    );

    const latestActive = activeIncidents[0] || (incidents.length > 0 ? incidents[0] : null);
    const systemStatus =
      activeIncidents.length > 0 ? 'CRITICAL' : camerasOffline > 0 ? 'WARNING' : 'OPERATIONAL';

    return {
      totalCameras,
      camerasOnline,
      camerasOffline,
      activeIncidents: activeIncidents.length,
      todayEventsCount: historyEvents.length,
      systemStatus,
      lastIncident: latestActive,
    };
  }

  public async startResponse(
    id: string,
    responderName = 'Nhân viên an ninh'
  ): Promise<Incident | null> {
    const incident = await incidentRepository.findIncidentById(id);
    if (!incident) return null;

    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    const timelineItem: IncidentTimeline = {
      id: `tl-${Date.now()}`,
      time: nowStr,
      title: 'Kích hoạt lực lượng phản ứng tại chỗ',
      description: `${responderName} đã chuyển trạng thái sang ĐANG XỬ LÝ (RESPONDING). Đội PCCC cơ sở đang tiếp cận hiện trường.`,
      type: 'RESPONDING',
      actor: responderName,
    };

    const updatedTimeline = [...incident.timeline, timelineItem];

    const updated = await incidentRepository.updateIncident(id, {
      status: 'RESPONDING',
      responseStartedAt: nowStr,
      responseStartedBy: responderName,
      timeline: updatedTimeline,
    });

    await incidentRepository.addHistoryEvent({
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

    return updated;
  }

  public async resolveIncident(
    id: string,
    resolverName = 'Nguyễn Văn A',
    notes = 'Đám cháy đã được kiểm soát hoàn toàn, không có thiệt hại về người.'
  ): Promise<Incident | null> {
    const incident = await incidentRepository.findIncidentById(id);
    if (!incident) return null;

    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    const timelineItem: IncidentTimeline = {
      id: `tl-${Date.now()}`,
      time: nowStr,
      title: 'Sự cố đã được giải quyết thành công',
      description: `${resolverName} đã kiểm tra hiện trường và đánh dấu ĐÃ XỬ LÝ (RESOLVED). ${notes}`,
      type: 'RESOLVED',
      actor: resolverName,
    };

    const updatedTimeline = [...incident.timeline, timelineItem];

    const updated = await incidentRepository.updateIncident(id, {
      status: 'RESOLVED',
      resolvedAt: nowStr,
      resolvedBy: resolverName,
      notes: notes || incident.notes,
      timeline: updatedTimeline,
    });

    await incidentRepository.addHistoryEvent({
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

    return updated;
  }

  public async markFalseAlarm(
    id: string,
    actorName = 'Trần Văn Mạnh',
    reason = 'Báo động giả do luồng hơi nhiệt'
  ): Promise<Incident | null> {
    const incident = await incidentRepository.findIncidentById(id);
    if (!incident) return null;

    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    const timelineItem: IncidentTimeline = {
      id: `tl-${Date.now()}`,
      time: nowStr,
      title: 'Xác nhận Báo Động Giả (FALSE ALARM)',
      description: `${actorName} đã kiểm tra trực tiếp qua camera và hiện trường. Lý do: ${reason}.`,
      type: 'FALSE_ALARM',
      actor: actorName,
    };

    const updatedTimeline = [...incident.timeline, timelineItem];

    const updated = await incidentRepository.updateIncident(id, {
      status: 'FALSE_ALARM',
      resolvedAt: nowStr,
      resolvedBy: actorName,
      notes: `Báo động giả: ${reason}`,
      timeline: updatedTimeline,
    });

    await incidentRepository.addHistoryEvent({
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

    return updated;
  }

  public async simulateFireEvent(): Promise<Incident> {
    const configs = await cameraRepository.findAllConfigs();
    const cam = configs[0] || { id: 'camera-01', name: 'Camera Live' };
    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    const incidents = await incidentRepository.findAllIncidents();

    const newInc: Incident = {
      id: `inc-${Date.now()}`,
      code: `FG-${new Date().getFullYear()}-${(incidents.length + 1).toString().padStart(3, '0')}`,
      cameraId: cam.id,
      cameraCode: cam.id,
      siteId: 'site-real',
      location: cam.name,
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
          title: `AI phát hiện đám cháy trên ${cam.name}`,
          description: `Mô hình phát hiện ngọn lửa với độ tin cậy 94%.`,
          type: 'DETECTED',
          actor: 'Favis AI Engine',
        },
      ],
      notes: `Sự cố phát hiện trên camera thực tế ${cam.name}.`,
    };

    await incidentRepository.createIncident(newInc);
    await incidentRepository.addHistoryEvent({
      id: `evt-${Date.now()}`,
      eventType: 'FIRE_CONFIRMED',
      cameraId: cam.id,
      cameraCode: cam.id,
      location: cam.name,
      severity: 'CRITICAL',
      timestamp: nowStr,
      status: 'ACTIVE',
      details: `Phát hiện đám cháy độ tin cậy 94% trên ${cam.name}`,
    });

    return newInc;
  }

  public async resolveLatestActiveIncident(resolverName = 'Vũ Diễm'): Promise<Incident | null> {
    const incidents = await incidentRepository.findAllIncidents();
    const active = incidents.find((i) => i.status === 'ACTIVE' || i.status === 'RESPONDING');
    if (!active) return null;
    return this.resolveIncident(active.id, resolverName);
  }
}

export const incidentService = new IncidentService();
