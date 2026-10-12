import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Incident, FireEvent } from '../models/incident.model.js';
import { INITIAL_INCIDENT, INITIAL_HISTORY_EVENTS } from '../data/seedIncidents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.FAVIS_DATA_DIR || path.resolve(__dirname, '../../data');
const INCIDENTS_FILE = path.join(DATA_DIR, 'incidents.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history-events.json');

export class IncidentRepository {
  private incidents: Incident[] = [];
  private historyEvents: FireEvent[] = [];

  constructor() {
    this.ensureDataFiles();
  }

  private ensureDataFiles(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // 1. Initialize Incidents
      if (!fs.existsSync(INCIDENTS_FILE)) {
        this.incidents = [{ ...INITIAL_INCIDENT }];
        this.saveToFile(INCIDENTS_FILE, this.incidents);
      } else {
        const raw = fs.readFileSync(INCIDENTS_FILE, 'utf-8');
        this.incidents = JSON.parse(raw);
      }

      // 2. Initialize History Events
      if (!fs.existsSync(HISTORY_FILE)) {
        this.historyEvents = [...INITIAL_HISTORY_EVENTS];
        this.saveToFile(HISTORY_FILE, this.historyEvents);
      } else {
        const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
        this.historyEvents = JSON.parse(raw);
      }
    } catch (err) {
      console.error('[IncidentRepository] Error initializing data files:', err);
      throw err;
    }
  }

  private saveToFile(filePath: string, data: unknown): void {
    try {
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, filePath);
    } catch (err) {
      console.error(`[IncidentRepository] Error saving to ${filePath}:`, err);
      throw err;
    }
  }

  // --- Incidents CRUD ---
  public async findAllIncidents(): Promise<Incident[]> {
    return [...this.incidents];
  }

  public async findIncidentById(id: string): Promise<Incident | null> {
    const inc = this.incidents.find(
      (i) => i.id.toLowerCase() === id.toLowerCase() || i.code.toLowerCase() === id.toLowerCase()
    );
    return inc ? { ...inc } : null;
  }

  public async findBySourceAlertId(sourceAlertId: string): Promise<Incident | null> {
    if (!sourceAlertId) return null;
    const inc = this.incidents.find(
      (i) => i.sourceAlertId && i.sourceAlertId.toLowerCase() === sourceAlertId.toLowerCase()
    );
    return inc ? { ...inc } : null;
  }

  public async createIncident(incident: Incident): Promise<Incident> {
    const existing = this.incidents.find(
      (i) =>
        i.id.toLowerCase() === incident.id.toLowerCase() ||
        (incident.sourceAlertId && i.sourceAlertId && i.sourceAlertId.toLowerCase() === incident.sourceAlertId.toLowerCase())
    );
    if (existing) {
      return { ...existing };
    }

    const next = [{ ...incident }, ...this.incidents];
    this.saveToFile(INCIDENTS_FILE, next);
    this.incidents = next;
    return { ...incident };
  }

  public async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | null> {
    const idx = this.incidents.findIndex(
      (i) => i.id.toLowerCase() === id.toLowerCase() || i.code.toLowerCase() === id.toLowerCase()
    );
    if (idx === -1) return null;

    const next = [...this.incidents];
    next[idx] = {
      ...this.incidents[idx],
      ...updates,
    };
    this.saveToFile(INCIDENTS_FILE, next);
    this.incidents = next;
    return { ...this.incidents[idx] };
  }

  // --- History Events CRUD ---
  public async findAllHistoryEvents(): Promise<FireEvent[]> {
    return [...this.historyEvents];
  }

  public async addHistoryEvent(event: FireEvent): Promise<FireEvent> {
    const existing = this.historyEvents.find(
      (e) => e.id.toLowerCase() === event.id.toLowerCase()
    );
    if (existing) {
      return { ...existing };
    }

    const next = [{ ...event }, ...this.historyEvents];
    this.saveToFile(HISTORY_FILE, next);
    this.historyEvents = next;
    return { ...event };
  }
}

export const incidentRepository = new IncidentRepository();
