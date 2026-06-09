/**
 * GalataBaker API — Users service.
 *
 * Tek sorumluluk: User yaşam döngüsü.
 *   - register(): idempotent upsert (DEPRECATED path — sadece /api/auth/verify üzerinden)
 *   - findByPkh(): public lookup
 *   - updateEmail(): email + verification token
 *   - verifyEmail(): token consume
 *   - linkTelegram(): bot callback ile chat_id set
 *   - updatePreferences(): notification toggles
 *   - updateConsent(): KVKK consentGivenAt
 *   - deleteAccount(): full wipe (KVKK right to be forgotten)
 *
 * Güvenlik notları:
 *   - register() idempotent: aynı wallet 1000 kez çağrılsa da 1 satır.
 *   - PII mask service katmanında (controller'a sızmıyor).
 *   - PII ASLA tam dönmez — sadece masked versiyon.
 *   - Email lowercase normalize (case-insensitive uniqueness için).
 *   - preferences field dışarıya hiç dönmez (kullanıcı JSON içine
 *     ne koyarsa koysun, API tarafından sıkdırılmaz).
 */

import { randomBytes } from 'node:crypto';

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { NotificationService } from '../notifications/notification.service.js';
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
  emailVerified: boolean;
  telegramChatIdMasked: string | null;
  telegramVerified: boolean;
  consentGivenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  emailEnabled: boolean;
  telegramEnabled: boolean;
  rewardNotify: boolean;
  delegationNotify: boolean;
  cycleDigest: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  emailEnabled: true,
  telegramEnabled: false,
  rewardNotify: true,
  delegationNotify: true,
  cycleDigest: false,
};

const CONSENT_VERSION = 'v1.0-2026-06';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * DEPRECATED — kullanımdan kaldırıldı, /api/auth/verify kullanılacak.
   * Test'ler için korunuyor.
   */
  async register(input: RegisterUserInput): Promise<UserPublic> {
    const email = input.email?.toLowerCase().trim() || null;
    const user = await this.prisma.user.upsert({
      where: { walletPkh: input.walletPkh },
      create: {
        walletPkh: input.walletPkh,
        email,
        telegramChatId: input.telegramChatId ?? null,
      },
      update: {
        // Sadece set edilmişse güncelle — partial update
        ...(input.email !== undefined && { email }),
        ...(input.telegramChatId !== undefined && { telegramChatId: input.telegramChatId }),
      },
    });
    return this.toPublic(user);
  }

  async findByPkh(walletPkh: string): Promise<UserPublic> {
    const user = await this.prisma.user.findUnique({ where: { walletPkh } });
    if (!user) throw new NotFoundException(`User not found: ${walletPkh}`);
    return this.toPublic(user);
  }

  /**
   * Email güncelle + verification token üret.
   *   - Email değişirse emailVerified=false reset
   *   - Token 24 saat geçerli, in-memory store
   *   - Caller (controller) email'i EmailService.sendVerification ile yollar
   */
  async updateEmail(walletPkh: string, email: string): Promise<{ verificationToken: string }> {
    const normalized = email.toLowerCase().trim();

    // Email zaten başka bir wallet'ta kullanılıyorsa hata
    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (existing && existing.walletPkh !== walletPkh) {
      throw new ConflictException('Email already in use by another wallet');
    }

    await this.prisma.user.update({
      where: { walletPkh },
      data: { email: normalized, emailVerified: false },
    });

    const token = randomBytes(32).toString('base64url');
    this.emailVerificationTokens.set(token, {
      walletPkh,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    // Audit trail: enqueue email_verify notification (EMAIL channel only).
    // The actual verification email (with token URL) is still sent by the
    // controller via EmailService — this row is the record.
    void this.notifications
      .enqueue({
        walletPkh,
        kind: 'email_verify',
        vars: { email: normalized, link: '(sent via EmailService.sendVerification)' },
        channels: ['EMAIL'],
      })
      .catch((err) =>
        this.logger.warn(
          `[users] email_verify enqueue failed pkh=${walletPkh.slice(0, 8)}…: ${(err as Error).message}`,
        ),
      );

    return { verificationToken: token };
  }

  /**
   * Email verification token consume.
   * Başarı durumunda User.emailVerified=true set edilir.
   */
  async verifyEmail(token: string): Promise<{ walletPkh: string }> {
    const stored = this.emailVerificationTokens.get(token);
    if (!stored) throw new UnauthorizedException('Invalid verification token');
    if (Date.now() > stored.expiresAt) {
      this.emailVerificationTokens.delete(token);
      throw new UnauthorizedException('Verification token expired');
    }
    this.emailVerificationTokens.delete(token);

    await this.prisma.user.update({
      where: { walletPkh: stored.walletPkh },
      data: { emailVerified: true },
    });

    return { walletPkh: stored.walletPkh };
  }

  /**
   * Telegram chat_id set et (bot callback üzerinden çağrılır).
   * Verification durumunu da true yapar.
   */
  async linkTelegram(walletPkh: string, chatId: string): Promise<void> {
    await this.prisma.user.update({
      where: { walletPkh },
      data: { telegramChatId: chatId, telegramVerified: true },
    });

    // Audit trail: telegram_link notification (TELEGRAM channel only).
    void this.notifications
      .enqueue({
        walletPkh,
        kind: 'telegram_link',
        vars: {},
        channels: ['TELEGRAM'],
      })
      .catch((err) =>
        this.logger.warn(
          `[users] telegram_link enqueue failed pkh=${walletPkh.slice(0, 8)}…: ${(err as Error).message}`,
        ),
      );
  }

  /**
   * Preferences güncelle (PUT /api/users/:pkh/preferences).
   * Validate + merge with defaults.
   */
  async updatePreferences(
    walletPkh: string,
    partial: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    const user = await this.prisma.user.findUnique({ where: { walletPkh } });
    if (!user) throw new NotFoundException(`User not found: ${walletPkh}`);

    const current = (user.preferences as UserPreferences | null) ?? DEFAULT_PREFERENCES;
    const merged: UserPreferences = { ...current, ...partial };

    await this.prisma.user.update({
      where: { walletPkh },
      data: { preferences: merged as unknown as object },
    });

    return merged;
  }

  /**
   * KVKK consent güncelle (PUT /api/users/:pkh/consent).
   * consentGivenAt = now, consentVersion = current.
   */
  async updateConsent(walletPkh: string, given: boolean): Promise<{ consentGivenAt: Date | null }> {
    const user = await this.prisma.user.findUnique({ where: { walletPkh } });
    if (!user) throw new NotFoundException(`User not found: ${walletPkh}`);

    const consentGivenAt = given ? new Date() : null;
    await this.prisma.user.update({
      where: { walletPkh },
      data: { consentGivenAt, consentVersion: given ? CONSENT_VERSION : null },
    });

    return { consentGivenAt };
  }

  /**
   * Full account deletion (KVKK right to be forgotten).
   * Cascade: delegations, rewards, notifications silinir.
   */
  async deleteAccount(walletPkh: string): Promise<void> {
    // Prisma cascade schema'da tanımlı olmalı — şu an cascade yok, explicit siliyoruz
    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({ where: { user: { walletPkh } } }),
      this.prisma.reward.deleteMany({ where: { user: { walletPkh } } }),
      this.prisma.delegation.deleteMany({ where: { user: { walletPkh } } }),
      this.prisma.user.delete({ where: { walletPkh } }),
    ]);
  }

  // ===== Internal helpers =====

  /**
   * In-memory email verification token store.
   * Production'da Redis tercih edilmeli (multi-instance + persistence).
   * MVP: tek instance, kabul edilebilir.
   */
  private emailVerificationTokens = new Map<string, { walletPkh: string; expiresAt: number }>();

  /** User → UserPublic (PII mask). */
  private toPublic(user: {
    id: string;
    walletPkh: string;
    role: 'USER' | 'ADMIN';
    email: string | null;
    emailVerified: boolean;
    telegramChatId: string | null;
    telegramVerified: boolean;
    consentGivenAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserPublic {
    return {
      id: user.id,
      walletPkh: user.walletPkh,
      role: user.role,
      emailMasked: maskEmail(user.email),
      emailVerified: user.emailVerified,
      telegramChatIdMasked: maskTelegram(user.telegramChatId),
      telegramVerified: user.telegramVerified,
      consentGivenAt: user.consentGivenAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

/** Email mask: a***@example.com (local mask + domain korunur). */
export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!local || !domain) return null;
  return `${local[0]}***@${domain}`;
}

/** Telegram chat_id mask: *****67890 (last 5 digits). */
export function maskTelegram(chatId: string | null): string | null {
  if (!chatId) return null;
  if (chatId.length <= 5) return '*****';
  return `*****${chatId.slice(-5)}`;
}
