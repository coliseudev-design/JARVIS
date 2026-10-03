import { z } from 'zod';
export const Config = z.object({
  APP_MODE: z.enum(['development', 'foundation']),
  HOST: z.enum(['127.0.0.1', '::1', '0.0.0.0']).default('127.0.0.1'), PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  DATABASE_URL: z.string().url(), REDIS_URL: z.string().url(),
  AUTH_DATABASE_URL:z.string().url().optional(), APP_ENCRYPTION_KEY:z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
  PUBLIC_ORIGIN:z.string().url().optional(), MAILBOX_PATH:z.string().optional(),
});
export function readConfig(env: NodeJS.ProcessEnv) {
  const parsed = Config.safeParse(env);
  if (!parsed.success || (parsed.data.APP_MODE === 'development' && parsed.data.HOST === '0.0.0.0')) throw new Error('DEVELOPMENT_CONFIGURATION_REQUIRED');
  const authValues=[parsed.data.AUTH_DATABASE_URL,parsed.data.APP_ENCRYPTION_KEY,parsed.data.PUBLIC_ORIGIN,parsed.data.MAILBOX_PATH];
  if(authValues.some(Boolean)&&!authValues.every(Boolean))throw new Error('AUTH_CONFIGURATION_REQUIRED');
  if(parsed.data.PUBLIC_ORIGIN){
    const origin=new URL(parsed.data.PUBLIC_ORIGIN);
    if(origin.origin!==parsed.data.PUBLIC_ORIGIN||origin.username||origin.password)throw new Error('INVALID_PUBLIC_ORIGIN');
    if(parsed.data.APP_MODE==='foundation'&&origin.protocol!=='https:')throw new Error('HTTPS_ORIGIN_REQUIRED');
    if(parsed.data.APP_MODE==='development'&& !['127.0.0.1','localhost','[::1]'].includes(origin.hostname))throw new Error('LOCAL_ORIGIN_REQUIRED');
  }
  return parsed.data;
}
