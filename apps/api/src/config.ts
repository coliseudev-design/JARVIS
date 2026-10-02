import { z } from 'zod';
export const Config = z.object({
  APP_MODE: z.enum(['development', 'foundation']),
  HOST: z.enum(['127.0.0.1', '::1', '0.0.0.0']).default('127.0.0.1'), PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  DATABASE_URL: z.string().url(), REDIS_URL: z.string().url(),
});
export function readConfig(env: NodeJS.ProcessEnv) {
  const parsed = Config.safeParse(env);
  if (!parsed.success || (parsed.data.APP_MODE === 'development' && parsed.data.HOST === '0.0.0.0')) throw new Error('DEVELOPMENT_CONFIGURATION_REQUIRED');
  return parsed.data;
}
