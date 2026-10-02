import { randomUUID } from 'node:crypto';
import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import pg from 'pg';
if (process.env.APP_MODE !== 'foundation' && process.env.APP_MODE !== 'development') throw new Error('Foundation environment required');
if (!process.env.WORKER_DATABASE_URL || !process.env.REDIS_URL) throw new Error('Worker configuration required');
const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const eventConnection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const pool = new pg.Pool({ connectionString: process.env.WORKER_DATABASE_URL });
const queue = new Queue('jarvis-foundation', { connection });
const events = new QueueEvents('jarvis-foundation', { connection: eventConnection });
let job;
try {
  await events.waitUntilReady();
  const id = randomUUID();
  job = await queue.add('synthetic_probe', { id, kind: 'synthetic_probe' }, { jobId: id });
  const result = await job.waitUntilFinished(events, 15000);
  if (!result.recorded) throw new Error('Worker did not record probe');
  const persisted = await pool.query('SELECT id FROM jarvis.foundation_checks WHERE id=$1', [id]);
  if (persisted.rowCount !== 1) throw new Error('Probe missing');
  console.log('Queue → worker → PostgreSQL synthetic probe passed');
} finally {
  if (job) await job.remove();
  await queue.close(); await events.close(); connection.disconnect(); eventConnection.disconnect(); await pool.end();
}
