import { z } from 'zod';

export const HealthSchema = z.strictObject({ status: z.enum(['alive', 'ready']) });
export const ErrorSchema = z.strictObject({ error: z.strictObject({
  code: z.string().regex(/^[A-Z_]+$/), message: z.string().max(200),
  correlation_id: z.uuid(), retryable: z.boolean(),
}) });
export const AvailabilitySchema = z.enum(['available', 'unavailable', 'not_configured', 'development_only']);
export const SystemStatusSchema = z.strictObject({
  schema_version: z.literal(1), mode: z.enum(['development', 'foundation']),
  capabilities: z.strictObject({
    foundation: AvailabilitySchema, authentication: AvailabilitySchema,
    chat: AvailabilitySchema, memory: AvailabilitySchema, integrations: AvailabilitySchema,
  }),
});
export type SystemStatus = z.infer<typeof SystemStatusSchema>;
export const toJsonSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { target: 'draft-7' });

// Only foundational state events are executable here. Full variants belong to F05.
export const RunStateEventSchema = z.strictObject({
  event_id: z.uuid(), sequence: z.string().regex(/^[1-9][0-9]*$/), schema_version: z.literal(1),
  conversation_id: z.uuid(), run_id: z.uuid(), occurred_at: z.iso.datetime(),
  type: z.literal('run.queued'), payload: z.strictObject({ state: z.literal('queued') }),
});
