import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AlertJournal } from '../alert-journal.mjs';
import { AlertStore } from '../alert-store.mjs';
import { EvidenceStore } from '../evidence-store.mjs';

test('pending alert/evidence survives restart and bounded history until durable acknowledgement', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'favis-persistence-'));
  const filename = path.join(directory, 'alerts.json');
  const journal = new AlertJournal(filename, 2);
  const evidence = new EvidenceStore(directory, 2, true);
  const store = new AlertStore({ cameraId: 'test', capacity: 2, journal, evidenceStore: evidence });
  const ids = [];
  for (let i = 1; i <= 125; i++) {
    const id = randomUUID(); ids.push(id);
    const frame = { data: Buffer.alloc(3), width: 1, height: 1 };
    store.publish({ id, cameraId: 'test', class: 'fire', timestamp: new Date().toISOString(), sequence: i }, evidence.prepare(id, frame));
  }
  const restored = new AlertJournal(filename, 2);
  const restartedEvidence = new EvidenceStore(directory, 2, true);
  assert.equal(restored.state.pending.length, 125);
  assert.equal(restored.state.history.length, 2);
  assert.ok(existsSync(restartedEvidence.pathFor(ids[0])));
  restored.acknowledge(ids.slice(0, 100));
  assert.equal(new AlertJournal(filename, 2).state.pending.length, 25);
  // A delayed publisher using an older journal must not overwrite acknowledgements.
  journal.append({ id: randomUUID() });
  assert.equal(new AlertJournal(filename, 2).state.pending.length, 26);
  restored.acknowledge(ids.slice(100));
  assert.equal(new AlertJournal(filename, 2).state.pending.length, 1);
});
