import { z } from 'zod';

// .strict() mirrors additionalProperties: false on the nested signal and summary JSON Schema objects.
const SignalSchema = z.object({
  rating: z.enum(['BUY', 'SELL', 'HOLD']),
  action: z.string(),
  entry_price: z.number().min(0).optional(),
  stop_loss: z.number().min(0).optional(),
  price_target: z.number().min(0).optional(),
  time_horizon: z.string(),
  confidence: z.number().min(0).max(1),
  time_window: z.enum(['short-term', 'medium-term', 'long-term']),
}).strict();

const SummarySchema = z.object({
  executive_summary: z.string(),
  investment_thesis: z.string(),
  key_risk: z.string(),
}).strict();

// Top-level schema uses default Zod strip behaviour (unknown keys removed, not rejected).
// This mirrors additionalProperties: true in signal-schema.json, allowing DynamoDB metadata
// fields (PK, SK, ttl) to coexist. Callers must hold those fields separately before
// calling validateSignalRecord — they will not appear on the returned SignalRecord.
export const SignalRecordSchema = z.object({
  analysis_id: z.string().uuid(),
  ticker: z.string().min(1).max(10),
  analysis_date: z.string().date(),
  depth: z.enum(['shallow', 'medium']),
  status: z.enum(['ANALYZING', 'ANALYZED', 'DELIVERING', 'DELIVERED', 'FAILED', 'TIMED_OUT', 'EXPIRED']),
  delivery_type: z.enum(['cron', 'on_demand']),
  signal: SignalSchema,
  summary: SummarySchema,
  analysts_used: z.array(z.string()).min(1),
  completed_at: z.string().datetime({ offset: true }),
  processing_ms: z.number().int().min(0),
  created_at: z.string().datetime({ offset: true }),
});

export type SignalRecord = z.infer<typeof SignalRecordSchema>;

export function validateSignalRecord(data: unknown): SignalRecord {
  return SignalRecordSchema.parse(data);
}
