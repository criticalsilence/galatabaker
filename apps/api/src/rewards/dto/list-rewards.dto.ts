/**
 * GalataBaker API — Rewards DTO (zod schema).
 *
 * apps/web → GET /api/rewards/:walletPkh?cycle=&kind=&limit=&offset=
 * apps/web → POST /api/rewards/claim  (internal — indexer, Adım 6 sonrası)
 *
 * Validasyon:
 *   - walletPkh: tz1-4 36 char
 *   - cycle: pozitif integer (Tezos cycle monotonik artıyor, 0'dan büyük)
 *   - kind: RewardKind enum (BAKING / ENDORSING / FEE / DENUNCIATION)
 *   - limit/offset: pagination
 *   - opsHash: o + 50-55 base58 (claim edilecek reward op)
 *   - claimedOpsHash: aynı format (claim tx'in op hash'i)
 *
 * Not: PKH_REGEX burada dağıtıyoruz (delegations'dan copy-paste).
 * İleride @common/extracts'a taşınabilir ama YAGNI.
 */

import { z } from 'zod';

export const PKH_REGEX = /^tz[1-4][a-km-zA-HJ-NP-Z1-9]{33}$/;
export const OPS_HASH_REGEX = /^o[a-km-zA-HJ-NP-Z1-9]{50,55}$/;

export const REWARD_KIND = z.enum(['BAKING', 'ENDORSING', 'FEE', 'DENUNCIATION']);

export const listRewardsQuerySchema = z.object({
  cycle: z.coerce.number().int().positive().optional(),
  kind: REWARD_KIND.optional(),
  limit: z.coerce.number().int().nonnegative().optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export type ListRewardsQuery = z.infer<typeof listRewardsQuerySchema>;

export const claimRewardSchema = z.object({
  opsHash: z
    .string()
    .regex(OPS_HASH_REGEX, 'Invalid Tezos operation hash format (expected o + 50-55 base58 chars)'),
  claimedOpsHash: z
    .string()
    .regex(OPS_HASH_REGEX, 'Invalid Tezos operation hash format (expected o + 50-55 base58 chars)'),
});

export type ClaimRewardInput = z.infer<typeof claimRewardSchema>;
