import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { IncidentService } from '../src/services/incidentService';
import { cameraService } from '../src/services/cameraService';
import { realtimeService } from '../src/services/realtimeService';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

beforeEach(() => {
  cameraService.setCameraStatus('cam-08', 'ONLINE', 'AI_MONITORING');
});

async function assertCameraNormal() {
  const camera = await cameraService.getCamera('cam-08');
  assert.equal(camera?.status, 'ONLINE');
  assert.equal(camera?.aiStatus, 'AI_MONITORING');
  assert.equal(camera?.fireConfidence, 0);
  assert.equal(camera?.smokeConfidence, 0);
}

test('a fresh dashboard does not create a sample fire incident', async () => {
  const service = new IncidentService(new MemoryStorage());
  const stats = await service.getDashboardStats();
  assert.equal(stats.activeIncidents, 0);
  assert.equal(stats.lastIncident, null);
  assert.notEqual(stats.systemStatus, 'CRITICAL');
  await assertCameraNormal();
});

test('resolving updates camera and dashboard together and survives a page reload', async t => {
  const storage = new MemoryStorage();
  const service = new IncidentService(storage);
  const incident = service.simulateFireEvent();
  await service.startResponse(incident.id, 'Security');

  const observations: Promise<void>[] = [];
  t.after(realtimeService.subscribeToIncidentEvents(updated => {
    if (updated.id !== incident.id || updated.status !== 'RESOLVED') return;
    observations.push((async () => {
      const stats = await service.getDashboardStats();
      assert.equal(stats.activeIncidents, 0);
      assert.equal(stats.lastIncident, null);
      await assertCameraNormal();
    })());
  }));

  await service.resolveIncident(incident.id, 'Operator', 'Checked and cleared');
  await Promise.all(observations);
  assert.equal(observations.length, 1);

  const reloaded = new IncidentService(storage);
  const saved = await reloaded.getIncident(incident.id);
  assert.equal(saved?.status, 'RESOLVED');
  assert.equal(saved?.resolvedBy, 'Operator');
  assert.equal(saved?.notes, 'Checked and cleared');
  assert.equal(saved?.timeline.at(-1)?.type, 'RESOLVED');
  assert.equal((await reloaded.getDashboardStats()).activeIncidents, 0);
  assert.ok((await reloaded.getHistory()).some(event => event.eventType === 'INCIDENT_RESOLVED'));
  await assertCameraNormal();
});

test('the quick fix action clears the latest incident and its camera', async () => {
  const service = new IncidentService(new MemoryStorage());
  service.simulateFireEvent();
  const resolved = service.resolveLatestActiveIncident('Operator');
  assert.equal(resolved?.status, 'RESOLVED');
  assert.equal((await service.getDashboardStats()).activeIncidents, 0);
  assert.equal(service.resolveLatestActiveIncident(), null);
  await assertCameraNormal();
});

test('a false alarm also restores monitoring and remains closed after reload', async () => {
  const storage = new MemoryStorage();
  const service = new IncidentService(storage);
  const incident = service.simulateFireEvent();
  await service.markFalseAlarm(incident.id, 'Operator', 'Steam');
  const reloaded = new IncidentService(storage);
  assert.equal((await reloaded.getIncident(incident.id))?.status, 'FALSE_ALARM');
  assert.equal((await reloaded.getDashboardStats()).activeIncidents, 0);
  await assertCameraNormal();
});

test('a camera stays in alarm while another incident on it is still open', async () => {
  const service = new IncidentService(new MemoryStorage());
  const first = service.simulateFireEvent();
  const second = service.simulateFireEvent();
  assert.notEqual(first.id, second.id);

  await service.resolveIncident(second.id);
  assert.equal((await service.getDashboardStats()).activeIncidents, 1);
  assert.equal((await cameraService.getCamera('cam-08'))?.status, 'FIRE');
  await service.markFalseAlarm(first.id);
  assert.equal((await service.getDashboardStats()).activeIncidents, 0);
  await assertCameraNormal();
});

test('closing an incident preserves an offline camera status', async () => {
  const service = new IncidentService(new MemoryStorage());
  const incident = service.simulateFireEvent();
  cameraService.setCameraStatus('cam-08', 'OFFLINE', 'OFFLINE', 98, 95);
  await service.resolveIncident(incident.id);
  const camera = await cameraService.getCamera('cam-08');
  assert.equal(camera?.status, 'OFFLINE');
  assert.equal(camera?.aiStatus, 'OFFLINE');
  assert.equal(camera?.fireConfidence, 0);
  assert.equal(camera?.smokeConfidence, 0);
});

test('closed incidents cannot be reopened or closed twice by stale actions', async () => {
  const service = new IncidentService(new MemoryStorage());
  const incident = service.simulateFireEvent();
  const resolved = await service.resolveIncident(incident.id, 'Operator');
  const historyLength = (await service.getHistory()).length;
  await service.startResponse(incident.id);
  await service.resolveIncident(incident.id, 'Another operator');
  await service.markFalseAlarm(incident.id);
  assert.deepEqual(await service.getIncident(incident.id), resolved);
  assert.equal((await service.getHistory()).length, historyLength);
  await assertCameraNormal();

  const newIncident = service.simulateFireEvent();
  await service.resolveIncident(incident.id);
  assert.equal((await service.getDashboardStats()).lastIncident?.id, newIncident.id);
  assert.equal((await cameraService.getCamera('cam-08'))?.status, 'FIRE');
});

test('open incidents also survive reload and are cleared when another tab resolves them', async () => {
  const storage = new MemoryStorage();
  const firstTab = new IncidentService(storage);
  const incident = firstTab.simulateFireEvent();
  const secondTab = new IncidentService(storage);
  assert.equal((await secondTab.getDashboardStats()).activeIncidents, 1);
  assert.equal((await cameraService.getCamera('cam-08'))?.status, 'FIRE');

  await firstTab.resolveIncident(incident.id);
  secondTab.restoreState();
  assert.equal((await secondTab.getIncident(incident.id))?.status, 'RESOLVED');
  assert.equal((await secondTab.getDashboardStats()).activeIncidents, 0);
  await assertCameraNormal();
});

test('corrupt or unavailable browser storage does not create a fire alarm', async () => {
  const storage = new MemoryStorage();
  for (const value of ['{', '{"version":1,"incidents":[{}],"historyEvents":[]}', '{"version":2}']) {
    storage.setItem('favis_incident_state', value);
    assert.equal((await new IncidentService(storage).getDashboardStats()).activeIncidents, 0);
  }
  const unavailable = new IncidentService({
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  });
  const incident = unavailable.simulateFireEvent();
  await unavailable.resolveIncident(incident.id);
  assert.equal((await unavailable.getDashboardStats()).activeIncidents, 0);
  await assertCameraNormal();
});

test('callers cannot mutate the stored incident through returned snapshots', async () => {
  const service = new IncidentService(new MemoryStorage());
  const incident = service.simulateFireEvent();
  incident.status = 'RESOLVED';
  incident.timeline.length = 0;
  const fetched = await service.getIncident(incident.id);
  assert.equal(fetched?.status, 'ACTIVE');
  assert.ok(fetched?.timeline.length);
  const listed = await service.getIncidents();
  listed[0].status = 'RESOLVED';
  assert.equal((await service.getDashboardStats()).activeIncidents, 1);
});
