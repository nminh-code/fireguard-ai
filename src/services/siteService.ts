import { Site, SiteZone, SystemSettings } from '../types';
import { INITIAL_SITE, INITIAL_SETTINGS } from './mockData';

const BACKEND_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

class SiteService {
  private siteCache: Site = { ...INITIAL_SITE };
  private settingsCache: SystemSettings = { ...INITIAL_SETTINGS };

  public async getSite(): Promise<Site> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/site`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          this.siteCache = json.data;
          return { ...this.siteCache };
        }
      }
    } catch {
      // Fallback
    }
    return { ...this.siteCache };
  }

  public async getZones(): Promise<SiteZone[]> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/site/zones`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          this.siteCache.zones = json.data;
          return [...json.data];
        }
      }
    } catch {
      // Fallback
    }
    return [...this.siteCache.zones];
  }

  public async getSettings(): Promise<SystemSettings> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/settings`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          this.settingsCache = json.data;
          return { ...this.settingsCache };
        }
      }
    } catch {
      // Fallback
    }
    return { ...this.settingsCache };
  }

  public async updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          this.settingsCache = json.data;
          return { ...this.settingsCache };
        }
      }
    } catch {
      // Fallback
    }
    this.settingsCache = { ...this.settingsCache, ...updates };
    return { ...this.settingsCache };
  }

  public async addZone(zone: Omit<SiteZone, 'id'>): Promise<SiteZone> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/site/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zone),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const newZone: SiteZone = json.data;
          this.siteCache.zones.push(newZone);
          return newZone;
        }
      }
    } catch {
      // Fallback
    }

    const fallbackZone: SiteZone = {
      ...zone,
      id: `zone-${Date.now().toString().slice(-4)}`,
    };
    this.siteCache.zones.push(fallbackZone);
    return fallbackZone;
  }

  public async updateZone(id: string, updates: Partial<SiteZone>): Promise<SiteZone | null> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/site/zones/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const updated: SiteZone = json.data;
          const idx = this.siteCache.zones.findIndex((z) => z.id === id);
          if (idx !== -1) {
            this.siteCache.zones[idx] = updated;
          }
          return updated;
        }
      }
    } catch {
      // Fallback
    }

    const idx = this.siteCache.zones.findIndex((z) => z.id === id);
    if (idx === -1) return null;
    this.siteCache.zones[idx] = { ...this.siteCache.zones[idx], ...updates };
    return this.siteCache.zones[idx];
  }

  public async deleteZone(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/site/zones/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          this.siteCache.zones = this.siteCache.zones.filter((z) => z.id !== id);
          return true;
        }
      }
    } catch {
      // Fallback
    }

    const initialLen = this.siteCache.zones.length;
    this.siteCache.zones = this.siteCache.zones.filter((z) => z.id !== id);
    return this.siteCache.zones.length < initialLen;
  }
}

export const siteService = new SiteService();
