import { createWorker } from './worker.js';
import { writeFile } from 'node:fs/promises';
try {
  if (!['development', 'foundation'].includes(process.env.APP_MODE ?? '') || !process.env.WORKER_DATABASE_URL || !process.env.REDIS_URL) throw new Error('CONFIG');
  const handle = await createWorker(process.env.WORKER_DATABASE_URL, process.env.REDIS_URL);
  let checking = false;
  const heartbeat = setInterval(async () => {
    if (checking || !handle.worker.isRunning()) return;
    checking = true;
    try { await handle.check(); await writeFile('/tmp/jarvis-worker-heartbeat', String(Date.now())); }
    catch { /* No heartbeat on broken dependencies; container health expires. */ }
    finally { checking = false; }
  }, 5000);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { clearInterval(heartbeat); void handle.close(); });
  console.log('JARVIS synthetic development worker started');
} catch { console.error('Worker startup failed. Development configuration and services are required.'); process.exitCode = 1; }
