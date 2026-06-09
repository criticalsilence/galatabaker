/**
 * GalataBaker API — Auth type definitions.
 *
 * SIWW (Sign-In With Wallet) flow type'ları.
 */

/**
 * Challenge — kullanıcının imzalayacağı canonical message.
 *
 * Format (RFC 7461 yaklaşımı):
 *   GalataBaker SIWW
 *   domain: <host>
 *   nonce: <random>
 *   timestamp: <unix_seconds>
 *
 * Bu mesaj cüzdana gönderilir, kullanıcı onaylar, imzalanır.
 * Server canonical message'ı yeniden kurup signature'ı doğrular.
 */
export interface Challenge {
  /** Server-generated random nonce (base64url, 32 bytes) */
  nonce: string;
  /** Canonical message (imzalanacak) */
  message: string;
  /** Unix seconds — bu tarihten sonra challenge geçersiz */
  expiresAt: number;
}

/**
 * SIWW input — frontend'den gelen imza + context.
 *
 * Güvenlik:
 *   - publicKey: imzayı doğrulamak için şart (ed25519)
 *   - signature: edsig... (Tezos base58 prefix)
 *   - nonce: challenge'dan gelmeli, tek seferlik
 *   - timestamp: challenge expiresAt'tan küçük olmalı
 */
export interface SIWWInput {
  walletPkh: string;
  publicKey: string;
  signature: string;
  nonce: string;
  timestamp: number;
}

/**
 * SIWW doğrulama sonucu — başarı durumunda JWT döner.
 */
export interface SIWWResult {
  /** JWT — Authorization: Bearer <token> */
  accessToken: string;
  /** Wallet address — sub claim */
  walletPkh: string;
  /** Token expiry (unix seconds) */
  expiresAt: number;
}

/**
 * JWT payload — middleware'de okunur, @CurrentUser() ile expose.
 */
export interface JWTPayload {
  sub: string; // walletPkh
  iat: number;
  exp: number;
}
