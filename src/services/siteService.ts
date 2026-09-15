import { Site, SiteZone, SystemSettings } from '../types';
import { INITIAL_SITE, INITIAL_SETTINGS } from './mockData';

class SiteService {
  private site: Site = { ...INITIAL_SITE };
  private settings: SystemSettings = { ...INITIAL_SETTINGS };

  public async getSite(): Promise<Site> {
    return { ...this.site };
  }

  public async getZones(): Promise<SiteZone[]> {
    return [...this.site.zones];
  }

  public async getSettings(): Promise<SystemSettings> {
    return { ...this.settings };
  }

  public async updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    this.settings = { ...this.settings, ...updates };
    return { ...this.settings };
  }

  public async addZone(zone: Omit<SiteZone, 'id'>): Promise<SiteZone> {
    const newZone: SiteZone = {
      ...zone,
      id: `zone-${Date.now().toString().slice(-4)}`,
    };
    this.site.zones.push(newZone);
    return newZone;
  }

  public async updateZone(id: string, updates: Partial<SiteZone>): Promise<SiteZone | null> {
    const idx = this.site.zones.findIndex((z) => z.id === id);
    if (idx === -1) return null;
    this.site.zones[idx] = { ...this.site.zones[idx], ...updates };
    return this.site.zones[idx];
  }

  public async deleteZone(id: string): Promise<boolean> {
    const initialLen = this.site.zones.length;
    this.site.zones = this.site.zones.filter((z) => z.id !== id);
    return this.site.zones.length < initialLen;
  }
}

export const siteService = new SiteService();
