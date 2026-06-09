/**
 * GalataBaker API — Delegations DTO (zod schema).
 *
 * Web tarafı broadcast sonrası bize şunu yolluyor:
 *   { walletPkh, bakerPkh, amount, opsHash }
 *
 * Validasyon:
 *   - walletPkh: tz1-4 36 char (PKH_REGEX users/bakers controller ile aynı)
 *   - bakerPkh: aynı format
 *   - amount: BigInt string, pozitif (mutez cinsinden, "1000000" = 1 tez)
 *   - opsHash: "o" prefix + base58 (32-byte Blake2b encoded)
 *
 * Not: amount'ı string olarak alıyoruz çünkü BigInt JSON-serializable değil.
 * 64-bit'i aşan tez miktarlarını number ile kaybederiz; string güvenli.
 */

import { z } from 'zod';

// Tezos PKH format (users/bakers controller ile paylaşımlı)
export const PKH_REGEX = /^tz[1-4][a-km-zA-HJ-NP-Z1-9]{33}$/;

// Tezos op hash: "o" prefix + 50-55 base58 char
// (32-byte Blake2b hash base58 encoded — yaklaşık 51-54 karakter)
export const OPS_HASH_REGEX = /^o[a-km-zA-HJ-NP-Z1-9]{50,55}$/;

/**
 * Pozitif BigInt string validate.
 * "0" reddedilir, "1000000" kabul, "-5" reddedilir, "1.5" reddedilir,
 * "abc" reddedilir, "999999999999999999999999" kabul (BigInt sınırına kadar).
 */
const positiveBigIntString = z
  .string()
  .regex(/^\d+$/, 'Amount must be a numeric string (mutez)')
  .refine((s) => s !== '0', 'Amount must be greater than 0')
  .refine((s) => {
    try {
      return BigInt(s) > 0n;
    } catch {
      return false;
    }
  }, 'Amount is not a valid positive integer');

export const createDelegationSchema = z.object({
  walletPkh: z
    .string()
    .regex(PKH_REGEX, 'Invalid Tezos address format (expected tz1/tz2/tz3/tz4 + 36 chars)'),
  bakerPkh: z
    .string()
    .regex(PKH_REGEX, 'Invalid baker address format (expected tz1/tz2/tz3/tz4 + 36 chars)'),
  amount: positiveBigIntString,
  opsHash: z
    .string()
    .regex(OPS_HASH_REGEX, 'Invalid Tezos operation hash format (expected o + 50-55 base58 chars)'),
});

export type CreateDelegationInput = z.infer<typeof createDelegationSchema>;

/**
 * Query schema — list delegations by wallet.
 * Pagination + status filter.
 */
export const listDelegationsQuerySchema = z.object({
  limit: z.coerce.number().int().nonnegative().optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  status: z.enum(['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED']).optional(),
});

export type ListDelegationsQuery = z.infer<typeof listDelegationsQuerySchema>;
