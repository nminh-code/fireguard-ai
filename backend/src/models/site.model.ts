export interface SiteZone {
  id: string;
  name: string;
  code: string;
  area: string; // e.g. "3,200 m²"
  description: string;
  coordinates: {
    x: number;
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

export interface EmergencyContact {
  name: string;
  role: string;
  phone: string;
}

export interface SystemSettings {
  siteName: string;
  siteAddress: string;
  detectionThreshold: number;
  smokeThreshold: number;
  verificationWindowSeconds: number;
  autoAlertAuthorities: boolean;
  pushNotifications: boolean;
  criticalAlertOverride: boolean;
  soundAlert: boolean;
  emailNotifications: boolean;
  emergencySms: boolean;
  emergencyContacts: EmergencyContact[];
}
