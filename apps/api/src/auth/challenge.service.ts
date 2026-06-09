/**
 * GalataBaker API — Challenge service (in-memory nonce store).
 *
 * SIWW flow'unun ilk adımı: client GET /api/auth/challenge çağırır,
 * server nonce üretir, canonical message döner. Client mesajı imzalar.
 *
 * Nonce storage: in-memory Map (MVP — production'da Redis).
 *   - TTL: 5 dakika (auth.config.ts'ten)
 *   - Tek kullanımlık: consume() sonrası silinir (replay attack koruması)
 *
 * Neden in-memory:
 *   - MVP scale: tek instance, ~10k user
 *   - Atomic: JS single-thread, race condition yok
 *   - Trade-off: restart → tüm pending challenge'lar expire olur (5dk
 *     TTL zaten kısa, kabul edilebilir)
 */
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import type { Challenge } from './auth.types.js';

interface StoredChallenge {
  nonce: string;
  createdAt: number;
}

@Injectable()
export class ChallengeService implements OnModuleDestroy {
  private readonly logger = new Logger(ChallengeService.name);
  private readonly store = new Map<string, StoredChallenge>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {
    // Her 60 saniye expired challenge'ları temizle
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.store.clear();
  }

  /**
   * Yeni challenge üret.
   *   - 32 byte random nonce (base64url)
   *   - Canonical message: domain + nonce + timestamp
   *   - TTL: config.SIWW_CHALLENGE_TTL_SECONDS
   */
  create(): Challenge {
    const nonce = this.generateNonce();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + this.config.SIWW_CHALLENGE_TTL_SECONDS;

    const message = [
      'GalataBaker SIWW',
      `domain: ${this.config.SIWW_DOMAIN}`,
      `nonce: ${nonce}`,
      `timestamp: ${now}`,
    ].join('\n');

    this.store.set(nonce, { nonce, createdAt: now });

    this.logger.log(
      `[auth] challenge issued nonce=${nonce.slice(0, 8)}… ttl=${this.config.SIWW_CHALLENGE_TTL_SECONDS}s`,
    );

    return { nonce, message, expiresAt };
  }

  /**
   * Challenge'ı consume et (tek kullanımlık).
   *   - Bulunursa ve expire olmamışsa: sil ve true döner
   *   - Bulunamazsa veya expire olmuşsa: false (replay veya invalid)
   */
  consume(nonce: string): boolean {
    const stored = this.store.get(nonce);
    if (!stored) return false;

    const now = Math.floor(Date.now() / 1000);
    const ttl = now - stored.createdAt;

    // Her durumda sil (tek kullanımlık — replay koruması)
    this.store.delete(nonce);

    if (ttl > this.config.SIWW_CHALLENGE_TTL_SECONDS) {
      this.logger.warn(`[auth] challenge expired nonce=${nonce.slice(0, 8)}… age=${ttl}s`);
      return false;
    }

    return true;
  }

  /**
   * Internal: Map'i temizle (interval tarafından çağrılır).
   * Private API, dışarıdan çağrılmaz.
   */
  private cleanup(): void {
    const now = Math.floor(Date.now() / 1000);
    let removed = 0;
    for (const [nonce, stored] of this.store) {
      if (now - stored.createdAt > this.config.SIWW_CHALLENGE_TTL_SECONDS) {
        this.store.delete(nonce);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.debug(`[auth] cleanup removed ${removed} expired challenges`);
    }
  }

  /**
   * 32 byte random nonce (base64url encoded, ~43 chars).
   * Node 18+ crypto.webcrypto — native, no dep.
   */
  private generateNonce(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString('base64url');
  }
}
