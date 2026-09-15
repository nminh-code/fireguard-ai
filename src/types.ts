export type UserRole = 'ADMIN' | 'MANAGER' | 'SECURITY';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastActive: string;
  avatarUrl?: string;
}

export interface Company {
  id: string;
  name: string;
  code: string;
}

export interface SiteZone {
  id: string;
  name: string;
  code: string;
  area: string; // e.g. "2,400 m²"
  description: string;
  coordinates: {
    x: number; // percentage in 2D map (0 - 100)
    y: number;
    width: number;
    height: number;
  };
  cameraIds: string[];
}

export interface Site {
  id: string;
  name: string;
  address: string;
  city: string;
  zones: SiteZone[];
}

export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'WARNING' | 'FIRE';

export interface Camera {
  id: string;
  code: string; // e.g. "CAM-08"
  name: string;
  zoneId: string;
  location: string; // e.g. "Kho nguyên liệu A - Cửa Đông"
  streamUrl: string;
  ipAddress: string;
  model: string;
  resolution: string;
  fps: number;
  status: CameraStatus;
  aiStatus: 'AI_MONITORING' | 'FIRE_DETECTED' | 'IDLE' | 'OFFLINE';
  lastSeen: string;
  lastUpdate: string;
  uptime: string;
  mapCoords: {
    x: number; // percentage on site map
    y: number;
  };
  previewSnapshotUrl?: string;
  fireConfidence?: number;
  smokeConfidence?: number;
}

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
  code: string; // e.g. "FG-2026-001"
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

export interface Notification {
  id: string;
  type: 'FIRE_CONFIRMED' | 'CAMERA_OFFLINE' | 'INCIDENT_UPDATE' | 'SYSTEM';
  title: string;
  message: string;
  location: string;
  cameraCode?: string;
  incidentId?: string;
  severity: IncidentSeverity;
  timestamp: string;
  read: boolean;
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

export interface SystemSettings {
  siteName: string;
  siteAddress: string;
  detectionThreshold: number; // e.g. 85%
  smokeThreshold: number; // e.g. 80%
  verificationWindowSeconds: number; // e.g. 3
  autoAlertAuthorities: boolean;
  pushNotifications: boolean;
  criticalAlertOverride: boolean;
  soundAlert: boolean;
  emailNotifications: boolean;
  emergencySms: boolean;
  emergencyContacts: Array<{
    name: string;
    role: string;
    phone: string;
  }>;
}

export type CameraBrand = 'Hikvision' | 'Dahua' | 'Ezviz' | 'Imou' | 'Other';
export type CameraProtocol = 'RTSP' | 'ONVIF' | 'HTTP' | 'HTTPS' | 'Other';
export type CameraConnectionStatus =
  | 'NOT_CONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'FAILED'
  | 'DISCONNECTED';

export interface CameraConnectionConfig {
  id: string;
  name: string;
  brand: CameraBrand;
  model?: string;
  ip: string;
  port?: number | string;
  protocol: CameraProtocol;
  username?: string;
  password?: string;
  streamUrl?: string;
  apiUrl?: string;
}

export interface CameraConnectionResult {
  cameraId: string;
  status: 'CONNECTED' | 'FAILED' | 'NOT_CONNECTED';
  streamStatus?: 'AVAILABLE' | 'UNAVAILABLE';
  apiStatus?: 'AVAILABLE' | 'UNAVAILABLE';
  lastChecked?: string;
  errorMessage?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}
