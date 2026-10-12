import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { AlertJournal } from '../../ai-pipeline/alert-journal.mjs';
import { EvidenceStore } from '../../ai-pipeline/evidence-store.mjs';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '../..');
async function freePort() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function until(condition, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { if (await condition()) return; } catch {} await delay(100); }
  throw new Error('Timed out waiting for test service/data');
}
async function stop(child) { if (!child || child.exitCode !== null) return;
  const closed = new Promise(resolve => child.once('close', resolve)); child.kill(); await closed; }

test('real Backend HTTP ingestion, independent polling, retries, restarts and frontend service contracts', { timeout: 60000 }, async t => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'favis-data-flow-'));
  const aiDirectory = path.join(directory, 'ai'); fs.mkdirSync(aiDirectory);
  for (const file of ['incidents','history-events','cameras','camera-configs','notifications']) fs.writeFileSync(path.join(directory, `${file}.json`), '[]');
  const aiPort = await freePort(), backendPort = await freePort();
  const aiBase = `http://127.0.0.1:${aiPort}`, base = `http://127.0.0.1:${backendPort}`;
  const journalFile = path.join(aiDirectory, 'alerts.json');
  const evidence = new EvidenceStore(aiDirectory, 100, true);
  const journal = new AlertJournal(journalFile, 100);
  const alerts = Array.from({ length: 125 }, (_, i) => ({
    id: randomUUID(), cameraId: 'test-camera', sessionId: i < 100 ? 'test-session-1' : 'test-session-2',
    class: i === 124 ? 'smoke' : 'fire', confidence: 0.8, box: [1, 1, 20, 20], boxFormat: 'xyxy',
    timestamp: new Date(Date.UTC(2026, 9, 13, 0, 0, i)).toISOString(), sequence: i % 100 + 1, width: 32, height: 32,
    evidenceUrl: null,
  }));
  const prepared = evidence.prepare(alerts[0].id, { data: Buffer.alloc(32 * 32 * 3), width: 32, height: 32 });
  prepared.commit(); alerts[0].evidenceUrl = prepared.url;
  alerts.forEach(alert => journal.append(alert));
  let ai, backend;
  let logs = '';
  function launchAi() { return spawn(process.execPath, ['ai-pipeline/tests/replay-server.fixture.mjs'], { cwd: root, windowsHide: true,
    env: { ...process.env, FAVIS_TEST_AI_DIR: aiDirectory, FAVIS_TEST_AI_PORT: String(aiPort) }, stdio: 'pipe' }); }
  function launchBackend() { const child = spawn(process.execPath, ['--import','tsx','backend/src/server.ts'], { cwd: root, windowsHide: true,
    env: { ...process.env, FAVIS_DATA_DIR: directory, AI_SERVICE_URL: aiBase, PORT: String(backendPort), HOST: '127.0.0.1' }, stdio: 'pipe' });
    child.stdout.on('data', data => { logs += data; }); child.stderr.on('data', data => { logs += data; }); return child; }
  t.after(async () => { await stop(backend); await stop(ai); });
  const json = async route => { const response = await fetch(base + '/api/v1' + route); assert.equal(response.status, 200); return response.json(); };
  ai = launchAi(); await until(async () => (await fetch(aiBase + '/health')).ok);
  backend = launchBackend(); await until(async () => (await fetch(base + '/health')).ok);

  await t.test('ingests 125 alerts without a frontend request and drains backlog past history capacity', async () => {
    await until(() => fs.existsSync(path.join(directory,'alerts.json')) && JSON.parse(fs.readFileSync(path.join(directory,'alerts.json'))).length === 125);
    await until(() => JSON.parse(fs.readFileSync(path.join(directory,'incidents.json'))).length === 124);
    assert.equal(JSON.parse(fs.readFileSync(journalFile)).pending.length, 0);
    const history = await json('/incidents/history'); assert.equal(history.data.length, 124);
    const incidents = await json('/incidents');
    assert.equal(new Set(incidents.data.map(item => item.sourceAlertId)).size, 124);
    assert.equal(new Set(incidents.data.map(item => item.code)).size, 124);
    assert.ok(incidents.data.every(item => item.timeline.length === 1));
  });
  await t.test('concurrent requests create no duplicates', async () => {
    await Promise.all(Array.from({ length: 10 }, () => json('/incidents')));
    assert.equal((await json('/incidents')).data.length, 124);
    assert.equal((await json('/incidents/history')).data.length, 124);
  });
  await t.test('history and evidence survive AI and Backend process restarts and AI outage', async () => {
    await stop(ai);
    assert.equal((await json('/alerts?limit=100')).retained, 125);
    const png = await fetch(base + `/api/v1/evidence/${alerts[0].id}.png`); assert.equal(png.status, 200);
    assert.equal((await png.arrayBuffer()).byteLength > 8, true);
    await stop(backend); backend = launchBackend(); await until(async () => (await fetch(base + '/health')).ok);
    assert.equal((await json('/incidents')).data.length, 124);
    assert.equal((await json('/incidents/history')).data.length, 124);
    assert.equal((await fetch(base + `/api/v1/evidence/${alerts[0].id}.png`)).status, 200);
    ai = launchAi(); await until(async () => (await fetch(aiBase + '/health')).ok);
    assert.equal((await fetch(aiBase + '/v1/alerts').then(r => r.json())).alerts.length, 100);
    assert.equal((await json('/incidents')).data.length, 124);
  });
  await t.test('persisted transitions and failed history write recover without duplicate incident', async () => {
    const id = `inc-${alerts[0].id}`;
    const response = await fetch(base + `/api/v1/incidents/${id}/start-response`, {
      method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ responderName:'Test responder' }) });
    assert.equal(response.status,200); assert.equal((await response.json()).data.timeline.length,2);
    const target = path.join(directory,'history-events.json');
    // Persist a new alert, then simulate the prior crash window by leaving its history absent.
    const next = { ...alerts[1], id: randomUUID(), sequence: 999 };
    new AlertJournal(journalFile,100).append(next);
    await stop(ai); ai=launchAi(); await until(async () => (await fetch(aiBase+'/health')).ok);
    await until(() => JSON.parse(fs.readFileSync(path.join(directory,'incidents.json'))).length === 125);
    await stop(backend);
    const events=JSON.parse(fs.readFileSync(target)).filter(item=>item.id !== `evt-${next.id}`); fs.writeFileSync(target,JSON.stringify(events));
    backend=launchBackend(); await until(async ()=>(await fetch(base+'/health')).ok);
    await until(()=>JSON.parse(fs.readFileSync(target)).some(item=>item.id===`evt-${next.id}`));
    assert.equal((await json('/incidents')).data.length,125);
    assert.equal((await json(`/incidents/${id}`)).data.timeline.length,2);
  });
  await t.test('frontend services consume actual Backend incident, timeline, alert, history and evidence', async () => {
    const bundle = await build({ stdin: { contents: `export { incidentService } from './src/services/incidentService';
      export { getAlertHistory, evidenceHref } from './src/services/monitoringAlertService';`, resolveDir: root },
      bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
      define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE_URL: base + '/api/v1' }) } });
    const frontend = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
    const incident = await frontend.incidentService.getIncident(`inc-${alerts[0].id}`);
    assert.equal(incident.timeline.length, 2);
    assert.equal(incident.sourceAlertId, alerts[0].id);
    const history = await frontend.getAlertHistory(new AbortController().signal);
    assert.equal(history.alerts.length, 20);
    assert.ok((await frontend.incidentService.getHistory()).some(item => item.id === `evt-${alerts[0].id}`));
    assert.equal((await fetch(frontend.evidenceHref(incident.snapshotUrl))).status, 200);
  });
  if (logs.includes('Persistence failed')) t.diagnostic(logs);
});

test('JSON repositories reject failed disk writes and do not expose unpersisted records', async () => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'favis-write-failure-'));
  for (const file of ['incidents','history-events','cameras','camera-configs']) fs.writeFileSync(path.join(directory,`${file}.json`),'[]');
  process.env.FAVIS_DATA_DIR = directory;
  const { IncidentRepository } = await import('../src/repositories/incident.repository.ts');
  const { CameraRepository } = await import('../src/repositories/camera.repository.ts');
  const { AlertRepository } = await import('../src/repositories/alert.repository.ts');
  const incidentRepo = new IncidentRepository(), cameraRepo = new CameraRepository(), alertRepo = new AlertRepository(directory);
  const originalRename = fs.renameSync, originalLog = console.error;
  fs.renameSync = () => { throw new Error('TEST_DISK_FAILURE'); }; console.error = () => {};
  try {
    await assert.rejects(incidentRepo.createIncident({ id:'test-id', code:'test-code', sourceAlertId:'test-alert' }), /TEST_DISK_FAILURE/);
    assert.equal((await incidentRepo.findAllIncidents()).length,0);
    await assert.rejects(cameraRepo.saveConfig({ id:'test-camera', name:'test' }),/TEST_DISK_FAILURE/);
    assert.equal((await cameraRepo.findAllConfigs()).length,0);
    assert.throws(()=>alertRepo.save({ id:'test-alert' }),/TEST_DISK_FAILURE/);
    assert.equal(alertRepo.list().length,0);
  } finally { fs.renameSync=originalRename; console.error=originalLog; }
});
