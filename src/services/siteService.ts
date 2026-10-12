import { Site, SiteZone, SystemSettings } from '../types';
import { backendRequest, jsonRequest } from './backendApi';

class SiteService {
  public getSite(): Promise<Site> { return backendRequest('/site'); }
  public getZones(): Promise<SiteZone[]> { return backendRequest('/site/zones'); }
  public getSettings(): Promise<SystemSettings> { return backendRequest('/settings'); }
  public updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    return backendRequest('/settings', jsonRequest('PUT', updates));
  }
  public addZone(zone: Omit<SiteZone, 'id'>): Promise<SiteZone> {
    return backendRequest('/site/zones', jsonRequest('POST', zone));
  }
  public updateZone(id: string, updates: Partial<SiteZone>): Promise<SiteZone | null> {
    return backendRequest(`/site/zones/${encodeURIComponent(id)}`, jsonRequest('PUT', updates), true);
  }
  public async deleteZone(id: string): Promise<boolean> {
    return Boolean(await backendRequest(`/site/zones/${encodeURIComponent(id)}`, { method: 'DELETE' }, true));
  }
}
export const siteService = new SiteService();
