import { Site, SiteZone, SystemSettings } from '../models/site.model.js';
import { siteRepository } from '../repositories/site.repository.js';

export class SiteService {
  public async getSite(): Promise<Site> {
    return siteRepository.getSite();
  }

  public async getZones(): Promise<SiteZone[]> {
    return siteRepository.getZones();
  }

  public async addZone(zone: Omit<SiteZone, 'id'>): Promise<SiteZone> {
    return siteRepository.addZone(zone);
  }

  public async updateZone(id: string, updates: Partial<SiteZone>): Promise<SiteZone | null> {
    return siteRepository.updateZone(id, updates);
  }

  public async deleteZone(id: string): Promise<boolean> {
    return siteRepository.deleteZone(id);
  }

  public async getSettings(): Promise<SystemSettings> {
    return siteRepository.getSettings();
  }

  public async updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    return siteRepository.updateSettings(updates);
  }
}

export const siteService = new SiteService();
