/**
 * GalataBaker API — Users service.
 *
 * Tek sorumluluk: wallet bağlama → user kaydı (idempotent upsert).
 * PII (email, telegram chat id) her zaman mask'lenerek döner.
 *
 * Güvenlik notları:
 *   - register() idempotent: aynı wallet 1000 kez çağrılsa da 1 satır.
 *   - PII mask service katmanında (controller'a sızmıyor).
 *   - PII ASLA tam dönmez — sadece masked versiyon.
 *   - Email lowercase normalize (case-insensitive uniqueness için).
 *   - preferences field dışarıya hiç dönmez (kullanıcı JSON içine
 *     ne koyarsa koysun, API tarafından sızdırılmaz).
 */

import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

export interface RegisterUserInput {
  walletPkh: string;
  email?: string;
  telegramChatId?: string;
}

export interface UserPublic {
  id: string;
  walletPkh: string;
  role: 'USER' | 'ADMIN';
  emailMasked: string | null;
  telegramChatIdMasked: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterUserInput): Promise<UserPublic> {
    // Email normalize — case-insensitive unique constraint ile uyumlu
    const email = input.email?.toLowerCase().trim() || null;

    // Idempotent upsert: yeni ise create, varsa update.
    // prisma.upsert atomik — race condition yok.
    const user = await this.prisma.user.upsert({
      where: { walletPkh: input.walletPkh },
      create: {
        walletPkh: input.walletPkh,
        email,
        telegramChatId: input.telegramChatId ?? null,
      },
      update: {
        // Sadece set edilmişse güncelle — partial update pattern.
        // Prisma'da "field varsa set, yoksa dokunma" için iki ayrı
        // update çağrısı yapmak yerine, build-time merge tercih ettik:
        // email set edilmemişse mevcut değeri korumak için DB'den
        // tekrar okumak yerine, update objesini conditional oluşturuyoruz.
        ...(input.email !== undefined && { email }),
        ...(input.telegramChatId !== undefined && {
          telegramChatId: input.telegramChatId,
        }),
      },
    });

    return this.toPublic(user);
  }

  async findByPkh(walletPkh: string): Promise<UserPublic> {
    const user = await this.prisma.user.findUnique({ where: { walletPkh } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toPublic(user);
  }

  /**
   * DB modelini public response'a map et.
   * PII (email, telegramChatId) her zaman mask'lenir.
   * preferences ASLA dönmez.
   */
  private toPublic(user: {
    id: string;
    walletPkh: string;
    role: 'USER' | 'ADMIN';
    email: string | null;
    telegramChatId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserPublic {
    return {
      id: user.id,
      walletPkh: user.walletPkh,
      role: user.role,
      emailMasked: maskEmail(user.email),
      telegramChatIdMasked: maskChatId(user.telegramChatId),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

// ── PII Mask Helpers (pure functions, no DB) ─────────────────────

/**
 * Email mask: "alice@example.com" → "a***@example.com"
 * Local part ilk harf + "***" + domain korunur.
 * Null/empty ise null döner.
 */
function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at <= 0) return '***'; // malformed
  const local = email.slice(0, at);
  const domain = email.slice(at); // "@example.com"
  return `${local[0]}***${domain}`;
}

/**
 * Telegram chat id mask: "1234567890" → "*****67890"
 * Son 5 hane görünür kalsın ki user kendi ID'sini tanıyabilsin.
 * Kısa ise tamamı mask.
 */
function maskChatId(chatId: string | null | undefined): string | null {
  if (!chatId) return null;
  if (chatId.length <= 5) return '*'.repeat(chatId.length);
  return '*'.repeat(chatId.length - 5) + chatId.slice(-5);
}
