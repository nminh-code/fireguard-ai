import { IncidentSeverity } from './incident.model.js';

export type NotificationType = 'FIRE_CONFIRMED' | 'CAMERA_OFFLINE' | 'INCIDENT_UPDATE' | 'SYSTEM';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  location?: string;
  cameraCode?: string;
  incidentId?: string;
  severity?: IncidentSeverity;
  timestamp: string;
  read: boolean;
}
