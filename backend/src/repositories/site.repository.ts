import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Site, SiteZone, SystemSettings } from '../models/site.model.js';
import { INITIAL_SITE, INITIAL_SETTINGS } from '../data/seedSite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const SITE_FILE = path.join(DATA_DIR, 'site.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

export class SiteRepository {
  private site: Site = { ...INITIAL_SITE };
  private settings: SystemSettings = { ...INITIAL_SETTINGS };

  constructor() {
    this.ensureDataFiles();
  }

  private ensureDataFiles(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // 1. Site file
      if (!fs.existsSync(SITE_FILE)) {
        this.site = { ...INITIAL_SITE };
        this.saveSiteToFile(this.site);
      } else {
        const raw = fs.readFileSync(SITE_FILE, 'utf-8');
        this.site = JSON.parse(raw);
      }

      // 2. Settings file
      if (!fs.existsSync(SETTINGS_FILE)) {
        this.settings = { ...INITIAL_SETTINGS };
        this.saveSettingsToFile(this.settings);
      } else {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        this.settings = JSON.parse(raw);
      }
    } catch (err) {
      console.error('[SiteRepository] Error initializing data files:', err);
      this.site = { ...INITIAL_SITE };
      this.settings = { ...INITIAL_SETTINGS };
    }
  }

  private saveSiteToFile(data: Site): void {
    try {
      const tempPath = `${SITE_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, SITE_FILE);
    } catch (err) {
      console.error(`[SiteRepository] Error saving to ${SITE_FILE}:`, err);
    }
  }

  private saveSettingsToFile(data: SystemSettings): void {
    try {
      const tempPath = `${SETTINGS_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, SETTINGS_FILE);
    } catch (err) {
      console.error(`[SiteRepository] Error saving to ${SETTINGS_FILE}:`, err);
    }
  }

  // --- Site & Zones ---
  public async getSite(): Promise<Site> {
    this.ensureDataFiles();
    return { ...this.site };
  }

  public async getZones(): Promise<SiteZone[]> {
    this.ensureDataFiles();
    return [...this.site.zones];
  }

  public async addZone(zone: Omit<SiteZone, 'id'>): Promise<SiteZone> {
    this.ensureDataFiles();
    const newZone: SiteZone = {
      ...zone,
      id: `zone-${Date.now().toString().slice(-4)}`,
    };
    this.site.zones.push(newZone);
    this.saveSiteToFile(this.site);
    return { ...newZone };
  }

  public async updateZone(id: string, updates: Partial<SiteZone>): Promise<SiteZone | null> {
    this.ensureDataFiles();
    const idx = this.site.zones.findIndex((z) => z.id.toLowerCase() === id.toLowerCase());
    if (idx === -1) return null;

    this.site.zones[idx] = {
      ...this.site.zones[idx],
      ...updates,
      id: this.site.zones[idx].id, // preserve id
    };
    this.saveSiteToFile(this.site);
    return { ...this.site.zones[idx] };
  }

  public async deleteZone(id: string): Promise<boolean> {
    this.ensureDataFiles();
    const initialLen = this.site.zones.length;
    this.site.zones = this.site.zones.filter((z) => z.id.toLowerCase() !== id.toLowerCase());
    if (this.site.zones.length < initialLen) {
      this.saveSiteToFile(this.site);
      return true;
    }
    return false;
  }

  // --- System Settings ---
  public async getSettings(): Promise<SystemSettings> {
    this.ensureDataFiles();
    return { ...this.settings };
  }

  public async updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    this.ensureDataFiles();
    this.settings = {
      ...this.settings,
      ...updates,
    };
    this.saveSettingsToFile(this.settings);
    return { ...this.settings };
  }
}

export const siteRepository = new SiteRepository();
