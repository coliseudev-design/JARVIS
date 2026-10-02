import { describe, it, expect } from 'vitest';
import { createApp } from './app.js';
import { readConfig } from './config.js';
describe('foundation API', () => {
  it('reports truthful unavailable capabilities and sanitizes dependency failures', async () => {
    const app = await createApp({ check: async () => { throw new Error('postgres://private-secret@host'); }, close: async () => {} });
    try {
      const live = await app.inject('/health/live'); expect(live.statusCode).toBe(200);
      const ready = await app.inject('/health/ready'); expect(ready.statusCode).toBe(503);
      expect(ready.body).not.toContain('private-secret');
      expect(ready.json().error.correlation_id).toBe(ready.headers['x-correlation-id']);
      const status = (await app.inject('/api/v1/system/status')).json();
      expect(status.capabilities.foundation).toBe('unavailable'); expect(status.capabilities.chat).toBe('unavailable');
      expect((await app.inject('/api/v1/auth/login')).statusCode).toBe(404);
    } finally { await app.close(); }
  });
  it('publishes only implemented routes and passes readiness after successful checks', async () => {
    const app = await createApp({ check: async () => {}, close: async () => {} });
    try {
      expect((await app.inject('/health/ready')).statusCode).toBe(200);
      const spec = (await app.inject('/api/v1/openapi.json')).json();
      expect(Object.keys(spec.paths).sort()).toEqual(['/api/v1/system/status', '/health/live', '/health/ready']);
    } finally { await app.close(); }
  });
  it('fails closed on missing services or live mode before authentication exists', () => {
    expect(() => readConfig({ APP_MODE: 'development' })).toThrow('DEVELOPMENT_CONFIGURATION_REQUIRED');
    expect(() => readConfig({ APP_MODE: 'production', DATABASE_URL: 'postgres://x', REDIS_URL: 'redis://x' })).toThrow();
  });
});
