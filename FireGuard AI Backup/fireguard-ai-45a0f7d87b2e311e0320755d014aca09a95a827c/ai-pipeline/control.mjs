import { loadEnvironment, readSettings } from './config.mjs';

loadEnvironment();
const command = process.argv[2];
if (!['start', 'stop', 'status'].includes(command)) {
  console.error('Usage: node ai-pipeline/control.mjs start|stop|status');
  process.exit(1);
}
try {
  const { port } = readSettings();
  const response = await fetch(`http://127.0.0.1:${port}/v1/pipeline/${command}`, {
    method: command === 'status' ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(command === 'status' ? {} : { body: '{}' }),
    signal: AbortSignal.timeout(10000),
  });
  console.log(JSON.stringify(await response.json(), null, 2));
  if (!response.ok) process.exitCode = 1;
} catch {
  console.error('AI frame API unavailable or settings invalid. Start npm run ai:frames first.');
  process.exitCode = 1;
}
