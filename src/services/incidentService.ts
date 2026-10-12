import { Incident, DashboardStats, FireEvent } from '../types';
import { realtimeService } from './realtimeService';
import { notificationService } from './notificationService';
import { backendRequest, jsonRequest } from './backendApi';

class IncidentService {
  public getIncidents(): Promise<Incident[]> { return backendRequest('/incidents'); }
  public getIncident(id: string): Promise<Incident | null> {
    return backendRequest(`/incidents/${encodeURIComponent(id)}`, {}, true);
  }
  public getHistory(): Promise<FireEvent[]> { return backendRequest('/incidents/history'); }
  public getDashboardStats(): Promise<DashboardStats> { return backendRequest('/incidents/stats'); }

  private async transition(id: string, action: string, body: unknown): Promise<Incident | null> {
    const updated = await backendRequest<Incident | null>(
      `/incidents/${encodeURIComponent(id)}/${action}`, jsonRequest('POST', body), true);
    if (updated) realtimeService.dispatchIncident(updated);
    return updated;
  }
  public startResponse(id: string, responderName = 'Nhân viên an ninh'): Promise<Incident | null> {
    return this.transition(id, 'start-response', { responderName });
  }
  public async resolveIncident(id: string, resolverName = 'Nguyễn Văn A',
    notes = 'Đám cháy đã được kiểm soát hoàn toàn, không có thiệt hại về người.'): Promise<Incident | null> {
    const updated = await this.transition(id, 'resolve', { resolverName, notes });
    if (updated) {
      void notificationService.addNotification({
        type: 'INCIDENT_UPDATE', title: '✅ SỰ CỐ ĐÃ ĐƯỢC XỬ LÝ',
        message: `Sự cố #${updated.code} tại ${updated.location} đã được xử lý bởi ${resolverName}.`,
        location: updated.location, cameraCode: updated.cameraCode, incidentId: updated.id, severity: 'LOW',
      }).catch(() => {});
    }
    return updated;
  }
  public markFalseAlarm(id: string, actorName = 'Trần Văn Mạnh',
    reason = 'Báo động giả do luồng hơi nhiệt'): Promise<Incident | null> {
    return this.transition(id, 'false-alarm', { actorName, reason });
  }
  public async simulateFireEvent(): Promise<Incident> {
    const created = await backendRequest<Incident>('/incidents/simulate', { method: 'POST' });
    realtimeService.dispatchIncident(created);
    return created;
  }
  public async resolveLatestActiveIncident(resolverName = 'Vũ Diễm'): Promise<Incident | null> {
    const active = (await this.getIncidents()).find(item => item.status === 'ACTIVE' || item.status === 'RESPONDING');
    return active ? this.resolveIncident(active.id, resolverName) : null;
  }
}
export const incidentService = new IncidentService();
