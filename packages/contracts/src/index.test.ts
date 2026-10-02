import { describe, expect, it } from 'vitest';
import { RunStateEventSchema, SystemStatusSchema } from './index.js';
describe('public contracts', () => {
  it('rejects fabricated identity or extra internal state', () => {
    expect(SystemStatusSchema.safeParse({ schema_version: 1, mode: 'development', capabilities: {
      foundation: 'development_only', authentication: 'unavailable', chat: 'not_configured', memory: 'unavailable', integrations: 'unavailable',
    }, secret: 'forbidden' }).success).toBe(false);
  });
  it('preserves event sequences beyond safe integers and refuses numeric sequences', () => {
    const e = { event_id: '00000000-0000-4000-8000-000000000011', conversation_id: '00000000-0000-4000-8000-000000000012',
      run_id: '00000000-0000-4000-8000-000000000013', sequence: '9007199254740993', schema_version: 1,
      occurred_at: '2026-10-02T00:00:00Z', type: 'run.queued', payload: { state: 'queued' } };
    expect(RunStateEventSchema.parse(e).sequence).toBe(e.sequence);
    expect(RunStateEventSchema.safeParse({ ...e, sequence: 1 }).success).toBe(false);
    expect(RunStateEventSchema.safeParse({ ...e, payload: { state: 'running' } }).success).toBe(false);
  });
});
