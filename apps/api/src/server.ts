import { Redis } from 'ioredis';
import { assertDatabaseReady, createPool } from '@jarvis/database';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createAuth } from './auth/store.js';

try {
  const cfg = readConfig(process.env);
  const pool = createPool(cfg.DATABASE_URL);
  const redis = new Redis(cfg.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null, commandTimeout: 2000 });
  redis.on('error', () => {}); // Errors are returned through readiness, never raw URLs.
  const auth=cfg.AUTH_DATABASE_URL ? await createAuth({databaseUrl:cfg.AUTH_DATABASE_URL,profileDatabaseUrl:cfg.DATABASE_URL,masterKey:cfg.APP_ENCRYPTION_KEY!,origin:cfg.PUBLIC_ORIGIN!,mailboxPath:cfg.MAILBOX_PATH!}):undefined;
  const app = await createApp({
    mode: cfg.APP_MODE,
    auth,origin:cfg.PUBLIC_ORIGIN,
    check: async () => { await assertDatabaseReady(pool); if(auth)await auth.check(); if (await redis.ping() !== 'PONG') throw new Error('REDIS_UNAVAILABLE'); },
    close: async () => { redis.disconnect(); await pool.end();if(auth)await auth.close(); },
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close(); });
  await app.listen({ host: cfg.HOST, port: cfg.PORT });
  console.log('JARVIS development API started');
} catch { console.error('API startup failed. Development configuration and required services must be available.'); process.exitCode = 1; }
