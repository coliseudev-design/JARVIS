import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { z } from 'zod';
import { createPool, assertDatabaseReady } from '@jarvis/database';

export const QUEUE_NAME = 'jarvis-foundation';
const Probe = z.strictObject({ id: z.uuid(), kind: z.literal('synthetic_probe') });
export async function createWorker(databaseUrl: string, redisUrl: string) {
  const pool = createPool(databaseUrl);
  try { await assertDatabaseReady(pool); } catch (err) { await pool.end(); throw err; }
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: true });
  connection.on('error', () => {});
  const worker = new Worker(QUEUE_NAME, async job => {
    if (job.name !== 'synthetic_probe') throw new Error('UNKNOWN_JOB');
    const data = Probe.parse(job.data); // No user/tenant/secret input accepted.
    await pool.query('INSERT INTO jarvis.foundation_checks (id, kind) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [data.id, data.kind]);
    return { id: data.id, recorded: true };
  }, { connection, concurrency: 1 });
  worker.on('error', () => {});
  await worker.waitUntilReady();
  return { worker, check: async () => {
    await assertDatabaseReady(pool);
    if (await connection.ping() !== 'PONG') throw new Error('REDIS_UNAVAILABLE');
  }, close: async () => { await worker.close(); connection.disconnect(); await pool.end(); } };
}
