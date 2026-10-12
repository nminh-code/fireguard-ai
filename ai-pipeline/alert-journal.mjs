import fs from 'node:fs';
import path from 'node:path';

// Keep every pending delivery until Backend acknowledges its durable copy.
export class AlertJournal {
  constructor(filename, capacity) {
    this.filename = filename;
    this.capacity = capacity;
    this.state = fs.existsSync(filename)
      ? JSON.parse(fs.readFileSync(filename, 'utf8'))
      : { history: [], pending: [], totalCreated: 0 };
    if (!Array.isArray(this.state.history) || !Array.isArray(this.state.pending)) throw new Error('INVALID_ALERT_JOURNAL');
  }
  save(next) {
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    const temporary = `${this.filename}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(next, null, 2));
    fs.renameSync(temporary, this.filename);
    this.state = next;
  }
  append(alert) {
    if (fs.existsSync(this.filename)) this.state = JSON.parse(fs.readFileSync(this.filename, 'utf8'));
    if (this.state.pending.some(item => item.id === alert.id)) return;
    this.save({ history: [...this.state.history, alert].slice(-this.capacity),
      pending: [...this.state.pending, alert], totalCreated: this.state.totalCreated + 1 });
  }
  pending(limit = 100) { return this.state.pending.slice(0, limit); }
  has(id) { return [...this.state.history, ...this.state.pending].some(item => item.id === id); }
  acknowledge(ids) {
    if (fs.existsSync(this.filename)) this.state = JSON.parse(fs.readFileSync(this.filename, 'utf8'));
    const accepted = new Set(ids);
    this.save({ ...this.state, pending: this.state.pending.filter(item => !accepted.has(item.id)) });
  }
}
