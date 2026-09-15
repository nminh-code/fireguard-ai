import { Incident, IncidentStatus, DashboardStats, FireEvent, IncidentTimeline } from '../types';
import { INITIAL_INCIDENT, INITIAL_HISTORY_EVENTS } from './mockData';
import { cameraService } from './cameraService';
import { realtimeService } from './realtimeService';
import { notificationService } from './notificationService';

class IncidentService {
  private incidents: Incident[] = [{ ...INITIAL_INCIDENT }];
  private historyEvents: FireEvent[] = [...INITIAL_HISTORY_EVENTS];

  constructor() {
    // Initial camera status for the active incident
    cameraService.setCameraStatus('cam-08', 'FIRE', 'FIRE_DETECTED', 96, 94);
  }

  public async getIncidents(): Promise<Incident[]> {
    return [...this.incidents];
  }

  public async getIncident(id: string): Promise<Incident | null> {
    const inc = this.incidents.find((i) => i.id === id || i.code.toLowerCase() === id.toLowerCase());
    return inc ? { ...inc } : null;
  }

  public async getHistory(): Promise<FireEvent[]> {
    return [...this.historyEvents];
  }

  public async getDashboardStats(): Promise<DashboardStats> {
    const cameras = await cameraService.getCameras();
    const onlineCount = cameras.filter((c) => c.status === 'ONLINE' || c.status === 'FIRE').length;
    const offlineCount = cameras.filter((c) => c.status === 'OFFLINE').length;
    const activeIncidents = this.incidents.filter(
      (i) => i.status === 'ACTIVE' || i.status === 'RESPONDING'
    );

    const latestActive = activeIncidents[0] || (this.incidents.length > 0 ? this.incidents[0] : null);

    const systemStatus = activeIncidents.length > 0 ? 'CRITICAL' : offlineCount > 0 ? 'WARNING' : 'OPERATIONAL';

    return {
      totalCameras: cameras.length,
      camerasOnline: onlineCount,
      camerasOffline: offlineCount,
      activeIncidents: activeIncidents.length,
      todayEventsCount: this.historyEvents.filter((e) => e.timestamp.includes('Hôm nay')).length,
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
      description: `${responderName} đã chuyển trạng thái sang ĐANG XỬ LÝ (RESPONDING). Đội PCCC cơ sở đang tiếp cận hiện trường với thiết bị chuyên dụng.`,
      type: 'RESPONDING',
      actor: responderName,
    };
    incident.timeline.push(timelineItem);

    // Add to history
    this.historyEvents.unshift({
      id: `evt-${Date.now()}`,
      eventType: 'FIRE_CONFIRMED',
      cameraId: incident.cameraId,
      cameraCode: incident.cameraCode,
      location: incident.location,
      severity: incident.severity,
      timestamp: `Hôm nay, ${nowStr}`,
      status: 'RESPONDING',
      details: `${responderName} bắt đầu triển khai dập lửa tại ${incident.location}`,
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

    // Reset camera state to ONLINE & AI MONITORING
    cameraService.setCameraStatus(incident.cameraId, 'ONLINE', 'AI_MONITORING', 0, 0);

    // Notification of resolution
    notificationService.addNotification({
      type: 'INCIDENT_UPDATE',
      title: '✅ SỰ CỐ ĐÃ ĐƯỢC XỬ LÝ',
      message: `Sự cố #${incident.code} tại ${incident.location} đã được xử lý bởi ${resolverName}.`,
      location: incident.location,
      cameraCode: incident.cameraCode,
      incidentId: incident.id,
      severity: 'LOW',
    });

    // Add to history
    this.historyEvents.unshift({
      id: `evt-${Date.now()}`,
      eventType: 'INCIDENT_RESOLVED',
      cameraId: incident.cameraId,
      cameraCode: incident.cameraCode,
      location: incident.location,
      severity: 'LOW',
      timestamp: `Hôm nay, ${nowStr}`,
      status: 'RESOLVED',
      details: `Sự cố ${incident.code} được giải quyết bởi ${resolverName}`,
    });

    realtimeService.dispatchIncident(incident);
    return { ...incident };
  }

  public async markFalseAlarm(id: string, actorName = 'Trần Văn Mạnh', reason = 'Báo động giả do luồng hơi nhiệt'): Promise<Incident | null> {
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

    // Reset camera
    cameraService.setCameraStatus(incident.cameraId, 'ONLINE', 'AI_MONITORING', 0, 0);

    // History
    this.historyEvents.unshift({
      id: `evt-${Date.now()}`,
      eventType: 'FALSE_ALARM',
      cameraId: incident.cameraId,
      cameraCode: incident.cameraCode,
      location: incident.location,
      severity: 'LOW',
      timestamp: `Hôm nay, ${nowStr}`,
      status: 'FALSE_ALARM',
      details: `Báo động giả tại ${incident.location}: ${reason}`,
    });

    realtimeService.dispatchIncident(incident);
    return { ...incident };
  }

  /**
   * Section 16: SIMULATE FIRE EVENT (Demo action)
   * 1. Creates FIRE_CONFIRMED event
   * 2. Creates incident
   * 3. Camera switches to FIRE
   * 4. Dashboard active incidents increments
   * 5. Notification badge increments
   * 6. Notification popup appears
   * 7. Incident Timeline is created
   * 8. Site Map camera marker turns red pulsing
   */
  public simulateFireEvent(): Incident {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
    const incNumber = (this.incidents.length + 1).toString().padStart(3, '0');
    const incidentCode = `FG-2026-${incNumber}`;
    const incidentId = `inc-${Date.now().toString().slice(-6)}`;

    // Set camera CAM-08 to FIRE
    cameraService.setCameraStatus('cam-08', 'FIRE', 'FIRE_DETECTED', 98, 95);

    const newIncident: Incident = {
      id: incidentId,
      code: incidentCode,
      cameraId: 'cam-08',
      cameraCode: 'CAM-08',
      siteId: 'site-hp-01',
      location: 'Kho nguyên liệu A',
      eventType: 'FIRE_CONFIRMED',
      fireConfidence: 98,
      smokeConfidence: 95,
      severity: 'CRITICAL',
      status: 'ACTIVE',
      detectedAt: timeStr,
      snapshotUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
      timeline: [
        {
          id: `tl-1-${Date.now()}`,
          time: timeStr,
          title: 'AI phát hiện đám cháy ngọn lửa bùng phát',
          description: 'Mô hình FireGuard Vision phát hiện cụm lửa với độ tin cậy 98% và mật độ khói 95% tại khu vực Kệ 04.',
          type: 'DETECTED',
          actor: 'FireGuard AI Engine',
        },
        {
          id: `tl-2-${Date.now()}`,
          time: timeStr,
          title: 'Hệ thống kích hoạt sự cố FIRE_CONFIRMED',
          description: `Tạo mã sự cố khẩn cấp #${incidentCode}. Cấp độ: CRITICAL.`,
          type: 'CREATED',
          actor: 'FireGuard Backend',
        },
        {
          id: `tl-3-${Date.now()}`,
          time: timeStr,
          title: 'Gửi chuông & cảnh báo thời gian thực',
          description: 'Đã phát cảnh báo khẩn cấp tới màn hình trực an ninh, còi báo động xưởng và gửi SMS quản lý.',
          type: 'NOTIFIED',
          actor: 'Emergency Dispatcher',
        },
      ],
      notes: 'Nguy cơ bén sang các pallet hóa chất lân cận trong vòng 3 phút nếu không xử lý tức thì.',
    };

    // Prepend new incident so it's top
    this.incidents.unshift(newIncident);

    // Create Notification
    notificationService.addNotification({
      type: 'FIRE_CONFIRMED',
      title: '🔥 FIRE CONFIRMED',
      message: `Kho nguyên liệu A - Camera CAM-08 | Nguy cơ cấp bách (Critical). AI xác nhận 98%.`,
      location: 'Kho nguyên liệu A',
      cameraCode: 'CAM-08',
      incidentId: newIncident.id,
      severity: 'CRITICAL',
    });

    // History event
    this.historyEvents.unshift({
      id: `evt-${Date.now()}`,
      eventType: 'FIRE_CONFIRMED',
      cameraId: 'cam-08',
      cameraCode: 'CAM-08',
      location: 'Kho nguyên liệu A',
      severity: 'CRITICAL',
      timestamp: `Hôm nay, ${timeStr}`,
      status: 'ACTIVE',
      details: 'Phát hiện ngọn lửa bùng phát từ pallet, AI confidence 98%',
    });

    // Broadcast
    realtimeService.dispatchIncident(newIncident);
    return newIncident;
  }

  /**
   * Section 16: Quick RESOLVE INCIDENT for demo
   */
  public resolveLatestActiveIncident(resolverName = 'Nguyễn Văn A'): Incident | null {
    const active = this.incidents.find((i) => i.status === 'ACTIVE' || i.status === 'RESPONDING');
    if (!active) return null;
    this.resolveIncident(active.id, resolverName, 'Đã sử dụng bình bọt chữa cháy dập tắt hoàn toàn.');
    return active;
  }
}

export const incidentService = new IncidentService();
