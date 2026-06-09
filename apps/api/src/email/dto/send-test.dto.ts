/**
 * GalataBaker API — Email DTO (zod).
 *
 * /test endpoint input validation. MVP'de caller internal trusted
 * (scheduler / admin UI) — ek auth Adım 8 hardening'de.
 */

import { z } from 'zod';

export const sendTestSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1).max(998),
  html: z.string().min(1).max(100_000),
  text: z.string().optional(),
});

export type SendTestInput = z.infer<typeof sendTestSchema>;
