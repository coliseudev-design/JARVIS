import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { createPool, assertDatabaseReady } from '../../packages/database/src/index.js';
import { migrate } from '../../packages/database/src/migrate.js';
import { createWorker, QUEUE_NAME } from '../../apps/worker/src/worker.js';
import { createApp } from '../../apps/api/src/app.js';
import { SystemStatusSchema } from '../../packages/contracts/src/index.js';

const { DATABASE_URL, WORKER_DATABASE_URL, MIGRATION_DATABASE_URL, REDIS_URL } = process.env;
if (!DATABASE_URL || !WORKER_DATABASE_URL || !MIGRATION_DATABASE_URL || !REDIS_URL) throw new Error('Integration tests require explicit real development services. Use scripts/with-dev-env.sh.');
if (process.env.APP_MODE !== 'development') throw new Error('Integration tests refuse non-development mode');
const api = createPool(DATABASE_URL);
const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const eventsRedis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
redis.on('error', () => {}); eventsRedis.on('error', () => {});
const queue = new Queue(QUEUE_NAME, { connection: redis });
const events = new QueueEvents(QUEUE_NAME, { connection: eventsRedis });
let handle: Awaited<ReturnType<typeof createWorker>>;
beforeAll(async () => {
  await migrate(MIGRATION_DATABASE_URL);
  await migrate(MIGRATION_DATABASE_URL);
  handle = await createWorker(WORKER_DATABASE_URL, REDIS_URL);
  await events.waitUntilReady();
}, 15000);
afterAll(async () => {
  if (handle) await handle.close();
  await queue.close(); await events.close(); redis.disconnect(); eventsRedis.disconnect(); await api.end();
});
describe('real PostgreSQL/pgvector + Redis foundation', () => {
  it('migrates repeatably and enforces non-owner least-privilege app role', async () => {
    await expect(assertDatabaseReady(api)).resolves.toBeUndefined();
    const versions = await api.query('SELECT version FROM jarvis.schema_migrations');
    expect(versions.rows).toEqual([{ version: 1 }]);
    const vector = await api.query("SELECT '[1,2,3]'::vector <-> '[1,2,4]'::vector AS distance");
    expect(vector.rows[0].distance).toBe(1);
    await expect(api.query('CREATE TABLE jarvis.forbidden (id integer)')).rejects.toMatchObject({ code: '42501' });
    await expect(api.query('INSERT INTO jarvis.foundation_checks (id,kind) VALUES ($1,$2)', [randomUUID(), 'synthetic_probe'])).rejects.toMatchObject({ code: '42501' });
    await expect(api.query('SET ROLE jarvis_owner')).rejects.toMatchObject({ code: '42501' });
  });
  it('executes a real queued probe once and rejects user-selected scope', async () => {
    const id = randomUUID();
    const job = await queue.add('synthetic_probe', { id, kind: 'synthetic_probe' }, { jobId: id });
    await expect(job.waitUntilFinished(events, 8000)).resolves.toEqual({ id, recorded: true });
    const replay = await queue.add('synthetic_probe', { id, kind: 'synthetic_probe' }, { jobId: id });
    expect(replay.id).toBe(job.id);
    expect((await api.query('SELECT id FROM jarvis.foundation_checks WHERE id=$1', [id])).rows).toEqual([{ id }]);
    const forgedId = randomUUID();
    const forged = await queue.add('synthetic_probe', { id: forgedId, kind: 'synthetic_probe', owner_user_id: randomUUID() });
    await expect(forged.waitUntilFinished(events, 8000)).rejects.toThrow();
    expect((await api.query('SELECT id FROM jarvis.foundation_checks WHERE id=$1', [forgedId])).rowCount).toBe(0);
    await job.remove(); await forged.remove();
  });
  it('serves readiness against real dependencies and validates public status', async () => {
    const app = await createApp({ check: async () => { await assertDatabaseReady(api); expect(await redis.ping()).toBe('PONG'); }, close: async () => {} });
    try {
      expect((await app.inject('/health/ready')).statusCode).toBe(200);
      const status = SystemStatusSchema.parse((await app.inject('/api/v1/system/status')).json());
      expect(status.capabilities.foundation).toBe('development_only'); expect(status.capabilities.chat).toBe('unavailable');
    } finally { await app.close(); }
  });
});
