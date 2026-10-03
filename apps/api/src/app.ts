import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import { randomUUID } from 'node:crypto';
import { ErrorSchema, HealthSchema, SystemStatusSchema, toJsonSchema } from '@jarvis/contracts';
import { AppError } from './errors.js';
import { ZodError } from 'zod';
import { registerAuthRoutes } from './auth/routes.js';
import type { AuthService } from './auth/store.js';

export type Dependencies = { check: () => Promise<void>; close: () => Promise<void>; mode?: 'development' | 'foundation'; auth?:AuthService; origin?:string };
export async function createApp(deps: Dependencies) {
  const app = Fastify({ logger: false, bodyLimit: 256 * 1024, genReqId: () => randomUUID(), ajv:{customOptions:{removeAdditional:false}} });
  await app.register(swagger, { openapi: { info: { title: 'JARVIS Foundation', version: '0.1.0' }, openapi: '3.0.3' } });
  app.addHook('onRequest', async (request, reply) => { reply.header('X-Correlation-ID', request.id); reply.header('Cache-Control', 'no-store'); });
  const error = (id: string, code: string, message: string, retryable = false) => ErrorSchema.parse({ error: { code, message, correlation_id: id, retryable } });
  app.setErrorHandler((err, req, reply) => {
    if(err instanceof AppError) { if(err.statusCode===429)reply.header('Retry-After','900');return reply.code(err.statusCode).send(error(req.id,err.code,err.publicMessage)); }
    if(err instanceof ZodError)return reply.code(400).send(error(req.id,'INVALID_REQUEST','Requisição inválida.'));
    const candidate = err instanceof Error && 'statusCode' in err ? err.statusCode : undefined;
    const status = typeof candidate === 'number' && candidate >= 400 && candidate < 500 ? candidate : 500;
    reply.code(status).send(error(req.id, status === 413 ? 'PAYLOAD_TOO_LARGE' : status < 500 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR', status < 500 ? 'Requisição inválida.' : 'Falha interna.'));
  });
  app.setNotFoundHandler((req, reply) => reply.code(404).send(error(req.id, 'RESOURCE_NOT_FOUND', 'Recurso não encontrado.')));
  app.get('/health/live', { schema: { response: { 200: toJsonSchema(HealthSchema) } } }, async () => ({ status: 'alive' as const }));
  app.get('/health/ready', { schema: { response: { 200: toJsonSchema(HealthSchema), 503: toJsonSchema(ErrorSchema) } } }, async (req, reply) => {
    try { await deps.check(); return { status: 'ready' as const }; }
    catch { return reply.code(503).send(error(req.id, 'DEPENDENCY_UNAVAILABLE', 'Dependência indisponível.', true)); }
  });
  app.get('/api/v1/system/status', { schema: { response: { 200: toJsonSchema(SystemStatusSchema) } } }, async () => {
    let ready = false;
    try { await deps.check(); ready = true; } catch { /* status is descriptive, readiness is the gate */ }
    return SystemStatusSchema.parse({ schema_version: 1, mode: deps.mode ?? 'development', capabilities: {
      foundation: ready ? 'development_only' : 'unavailable', authentication: deps.auth && ready ? 'development_only' : 'unavailable',
      chat: 'unavailable', memory: 'unavailable', integrations: 'not_configured',
    } });
  });
  if(deps.auth && deps.origin)registerAuthRoutes(app,deps.auth,deps.origin,(deps.mode??'development')==='development');
  app.get('/api/v1/openapi.json', { schema: { hide: true } }, async () => app.swagger());
  app.addHook('onClose', () => deps.close());
  return app;
}
