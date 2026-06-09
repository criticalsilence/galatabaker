/**
 * GalataBaker API — Auth DTO (zod).
 *
 * Auth endpoint input validasyonu.
 */

import { z } from 'zod';

// Tezos PKH regex: tz1, tz2, tz3, tz4
const PKH_REGEX = /^tz[1-4][a-km-zA-HJ-NP-Z1-9]{33}$/;

/**
 * SIWW doğrulama input'u.
 *   - walletPkh: Tezos adresi
 *   - publicKey: edpk... (32 bytes base58)
 *   - signature: edsig... (64 bytes base58)
 *   - nonce: base64url, server'dan gelen challenge nonce
 *   - timestamp: unix seconds (challenge creation time)
 */
export const siwwInputSchema = z.object({
  walletPkh: z.string().regex(PKH_REGEX, 'Invalid Tezos address format'),
  publicKey: z
    .string()
    .min(50, 'Public key too short')
    .max(60, 'Public key too long')
    .regex(/^edpk[1-9A-HJ-NP-Za-km-z]{50}$/, 'Invalid ed25519 public key format'),
  signature: z
    .string()
    .min(80, 'Signature too short')
    .max(100, 'Signature too long')
    .regex(/^edsig[1-9A-HJ-NP-Za-km-z]{80,}$/, 'Invalid ed25519 signature format'),
  nonce: z.string().min(20, 'Nonce too short').max(64, 'Nonce too long'),
  timestamp: z.number().int().positive(),
});

export type SiwwInputDto = z.infer<typeof siwwInputSchema>;
