export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'ACTIVE' | 'RESPONDING' | 'RESOLVED' | 'FALSE_ALARM';

export interface IncidentTimeline {
  id: string;
  time: string;
  title: string;
  description: string;
  type: 'DETECTED' | 'CREATED' | 'NOTIFIED' | 'ACKNOWLEDGED' | 'RESPONDING' | 'RESOLVED' | 'FALSE_ALARM';
  actor?: string;
}

export interface Incident {
  id: string;
  sourceAlertId?: string;
  code: string;
  cameraId: string;
  cameraCode: string;
  siteId: string;
  location: string;
  eventType: 'FIRE_CONFIRMED';
  fireConfidence: number;
  smokeConfidence: number;
  severity: IncidentSeverity;
  status: IncidentStatus;
  snapshotUrl?: string;
  videoUrl?: string;
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  responseStartedAt?: string;
  responseStartedBy?: string;
  timeline: IncidentTimeline[];
  notes?: string;
}

export interface FireEvent {
  id: string;
  eventType: 'FIRE_CONFIRMED' | 'SMOKE_DETECTED' | 'CAMERA_OFFLINE' | 'INCIDENT_RESOLVED' | 'FALSE_ALARM';
  cameraId: string;
  cameraCode: string;
  location: string;
  severity: IncidentSeverity;
  timestamp: string;
  status: IncidentStatus | 'OFFLINE' | 'ONLINE';
  details: string;
}

export interface DashboardStats {
  totalCameras: number;
  camerasOnline: number;
  camerasOffline: number;
  activeIncidents: number;
  todayEventsCount: number;
  systemStatus: 'OPERATIONAL' | 'WARNING' | 'CRITICAL';
  lastIncident?: Incident | null;
}
