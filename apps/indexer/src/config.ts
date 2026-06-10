import 'dotenv/config';

import { z } from 'zod';

/**
 * Indexer config — single source of truth for env-derived values.
 *
 * Loaded once at process start. Anything else reads from here.
 * Validation is zod so we fail-fast on a missing TZKT_BASE_URL
 * rather than getting a confusing 404 inside the sync loop.
 */

const Schema = z.object({
  TZKT_BASE_URL: z.string().url().default('https://api.bakingnet.tzkt.io'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  BATCH_SIZE: z.coerce.number().int().positive().max(1000).default(1000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = z.infer<typeof Schema>;

export function loadConfig(): Config {
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid indexer config:\n${issues}`);
  }
  return parsed.data;
}
