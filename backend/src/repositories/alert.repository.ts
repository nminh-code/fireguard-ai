import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MonitoringAlert } from '../models/alert.model.js';

const dataDirectory = process.env.FAVIS_DATA_DIR || fileURLToPath(new URL('../../data/', import.meta.url));
const filenamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/i;

export class AlertRepository {
  private alerts: MonitoringAlert[];
  private readonly filename: string;
  private readonly evidenceDirectory: string;

  constructor(directory = dataDirectory) {
    this.filename = path.join(directory, 'alerts.json');
    this.evidenceDirectory = path.join(directory, 'evidence');
    this.alerts = fs.existsSync(this.filename) ? JSON.parse(fs.readFileSync(this.filename, 'utf8')) : [];
    if (!Array.isArray(this.alerts)) throw new Error('INVALID_ALERT_REPOSITORY');
  }

  list(limit?: number): MonitoringAlert[] {
    const alerts = [...this.alerts].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    return limit === undefined ? alerts : alerts.slice(0, limit);
  }
  find(id: string): MonitoringAlert | null { return this.alerts.find(item => item.id === id) || null; }

  save(alert: MonitoringAlert): void {
    if (this.find(alert.id)) return;
    const next = [...this.alerts, alert];
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    fs.writeFileSync(`${this.filename}.tmp`, JSON.stringify(next, null, 2));
    fs.renameSync(`${this.filename}.tmp`, this.filename);
    this.alerts = next;
  }

  readEvidence(filename: string): Buffer | null {
    if (!filenamePattern.test(filename)) return null;
    const file = path.join(this.evidenceDirectory, filename);
    return fs.existsSync(file) ? fs.readFileSync(file) : null;
  }
  saveEvidence(filename: string, bytes: ArrayBuffer): void {
    if (!filenamePattern.test(filename)) throw new Error('INVALID_EVIDENCE_FILENAME');
    const buffer = Buffer.from(bytes);
    if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('INVALID_EVIDENCE_PNG');
    fs.mkdirSync(this.evidenceDirectory, { recursive: true });
    const file = path.join(this.evidenceDirectory, filename);
    fs.writeFileSync(`${file}.tmp`, buffer);
    fs.renameSync(`${file}.tmp`, file);
  }
}

export const alertRepository = new AlertRepository();
