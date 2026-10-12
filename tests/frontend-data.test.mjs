import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ stdin: { contents: `
  export { incidentService } from './src/services/incidentService';
  export { cameraService } from './src/services/cameraService';
  export { notificationService } from './src/services/notificationService';
  export { siteService } from './src/services/siteService';
  export { cameraConnectionService } from './src/services/cameraConnectionService';
  export { realtimeService } from './src/services/realtimeService';
  export { backendErrorMessage } from './src/services/backendApi';
  export { clearActiveAlert, evidenceHref } from './src/services/monitoringAlertService';
`, resolveDir: process.cwd() }, bundle:true, write:false, format:'esm', platform:'browser', logLevel:'silent' });
const services = await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const originalFetch = globalThis.fetch;
test.after(()=>{globalThis.fetch=originalFetch;});

test('offline reads reject instead of returning mock data, KPI or saved localStorage cameras', async () => {
  globalThis.fetch=async()=>{throw new Error('TEST_OFFLINE');};
  globalThis.localStorage={getItem:()=>JSON.stringify([{id:'poison-local-camera'}]),setItem:()=>{}};
  const operations=[()=>services.cameraService.getCameras(),()=>services.notificationService.getNotifications(),
    ()=>services.incidentService.getDashboardStats(),()=>services.incidentService.getIncidents(),
    ()=>services.siteService.getSettings(),()=>services.cameraConnectionService.refreshSavedCameras()];
  for(const operation of operations) await assert.rejects(operation,/TEST_OFFLINE/);
  assert.equal(services.cameraConnectionService.getSavedCameras().length,0);
  assert.ok(services.backendErrorMessage());
});

test('failed writes emit no successful incident/notification events and do not create local state', async () => {
  globalThis.fetch=async()=>new Response(JSON.stringify({success:false}),{status:503});
  let events=0;
  const unsub=services.realtimeService.subscribeToIncidentEvents(()=>events++);
  const unsubNotif=services.realtimeService.subscribeToNotifications(()=>events++);
  await assert.rejects(services.incidentService.startResponse('test-id'),/HTTP 503/);
  await assert.rejects(services.incidentService.simulateFireEvent(),/HTTP 503/);
  await assert.rejects(services.notificationService.addNotification({type:'SYSTEM',title:'test',message:'test'}),/HTTP 503/);
  await assert.rejects(services.cameraConnectionService.saveCamera({id:'test-camera',name:'test'}),/HTTP 503/);
  assert.equal(events,0); assert.equal(services.cameraConnectionService.getSavedCameras().length,0);
  unsub();unsubNotif();
});

test('successful empty Backend config replaces cache and save uses exactly one Backend request', async () => {
  const requests=[];
  globalThis.fetch=async(url,options)=>{
    requests.push({url,options});
    return Response.json({success:true,data:options?.method==='POST'?{id:'confirmed-camera',name:'test'}:[]});
  };
  await services.cameraConnectionService.saveCamera({id:'confirmed-camera',name:'test'});
  assert.equal(requests.length,1);
  assert.ok(requests[0].url.endsWith(':8080/api/v1/cameras/configs'));
  assert.equal(services.cameraConnectionService.getSavedCameras()[0].id,'confirmed-camera');
  assert.equal((await services.cameraConnectionService.refreshSavedCameras()).length,0);
});

test('HTTP 200 with cleared=false does not claim alert dismissal; evidence URL targets Backend', async()=>{
  globalThis.fetch=async()=>Response.json({success:true,cleared:false});
  assert.equal(await services.clearActiveAlert('test-alert'),false);
  assert.equal(services.evidenceHref('/api/v1/evidence/12345678-1234-4234-8234-123456789abc.png'),
    'http://localhost:8080/api/v1/evidence/12345678-1234-4234-8234-123456789abc.png');
});
