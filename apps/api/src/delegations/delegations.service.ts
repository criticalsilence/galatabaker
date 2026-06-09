/**
 * GalataBaker API — Delegations service.
 *
 * Tek sorumluluk: apps/web'in broadcast sonrası gönderdiği delegation
 * op hash'lerini kaydetmek + kullanıcının delegation geçmişini okumak.
 *
 * Akış (tipik kullanım):
 *   1. apps/web: cüzdan imzalar → Bakingnet'e broadcast → opsHash alır
 *   2. apps/web: POST /api/delegations { walletPkh, bakerPkh, amount, opsHash }
 *   3. Bu service: PENDING olarak DB'ye yazar
 *   4. (Adım 6) Indexer polling: op confirmed olunca status=CONFIRMED
 *   5. apps/web: GET /api/delegations/:walletPkh → kullanıcı history
 *
 * Güvenlik notları:
 *   - create() idempotent: aynı opsHash tekrar gelirse mevcut kayıt döner.
 *     Web tarafı retry'larında duplicate DB satırı oluşmaz.
 *   - User auto-register: walletPkh ile gelen kullanıcıyı otomatik oluşturur
 *     (UsersService.register() mantığı ile aynı — wallet-first, no friction).
 *   - Baker exists check: 404 — kullanıcı yanlış baker PKH gönderirse fail-fast.
 *   - amount string olarak DB'ye yazılır (BigInt), response'ta string döner.
 *   - userId leak yok — response'ta sadece walletPkh.
 *
 * @see Step 5 Task 5 plan.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import type { DelegationStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';

import type { CreateDelegationInput, ListDelegationsQuery } from './dto/create-delegation.dto.js';

export interface DelegationItem {
  id: string;
  walletPkh: string;
  bakerPkh: string;
  bakerAlias: string | null;
  amount: string; // BigInt -> string
  opsHash: string | null;
  status: DelegationStatus;
  blockLevel: number | null;
  blockTime: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListDelegationsResult {
  data: DelegationItem[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class DelegationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Yeni delegation kaydı oluştur (idempotent).
   *
   * - User yoksa walletPkh ile otomatik oluştur.
   * - Baker yoksa 404.
   * - Aynı opsHash ile daha önce kayıt varsa mevcut'u dön (race-safe).
   */
  async create(input: CreateDelegationInput): Promise<DelegationItem> {
    // 1. User upsert (auto-register)
    // UsersService mantığı ile aynı — fakat burada basit bir upsert yeterli
    // (email/telegramChatId yok, sadece walletPkh ile create).
    await this.prisma.user.upsert({
      where: { walletPkh: input.walletPkh },
      create: { walletPkh: input.walletPkh },
      update: {}, // Mevcut user'a dokunma
    });

    // 2. Baker exists check — 404 fail-fast
    const baker = await this.prisma.baker.findUnique({
      where: { pkh: input.bakerPkh },
      select: { pkh: true, alias: true },
    });
    if (!baker) {
      throw new NotFoundException(`Baker not found: ${input.bakerPkh}`);
    }

    // 3. Idempotent delegation create
    // Unique constraint üzerinden race-safe: aynı opsHash ile iki istek
    // gelirse biri P2002 alır ve mevcut'u okuruz.
    try {
      const created = await this.prisma.delegation.create({
        data: {
          user: { connect: { walletPkh: input.walletPkh } },
          baker: { connect: { pkh: input.bakerPkh } },
          amount: BigInt(input.amount),
          opsHash: input.opsHash,
          status: 'PENDING',
        },
        include: {
          baker: { select: { pkh: true, alias: true } },
          user: { select: { walletPkh: true } },
        },
      });

      return this.toItem(created);
    } catch (err) {
      // P2002 = unique constraint violation (opsHash zaten var)
      if (this.isUniqueViolation(err)) {
        const existing = await this.prisma.delegation.findUnique({
          where: { opsHash: input.opsHash },
          include: {
            baker: { select: { pkh: true, alias: true } },
            user: { select: { walletPkh: true } },
          },
        });
        if (existing) {
          return this.toItem(existing);
        }
      }
      throw err;
    }
  }

  /**
   * Wallet'e ait delegation'ları listele (pagination + status filter).
   */
  async listByWallet(
    walletPkh: string,
    query: ListDelegationsQuery,
  ): Promise<ListDelegationsResult> {
    // Limit clamp: 1-100 (DoS koruması)
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const offset = Math.max(0, query.offset ?? 0);

    // User yoksa boş dön (404 yerine empty — web tarafı "kullanıcım var mı?"
    // kontrolü yapmaya gerek kalmasın)
    const where = {
      user: { walletPkh },
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.delegation.findMany({
        where,
        include: {
          baker: { select: { pkh: true, alias: true } },
          user: { select: { walletPkh: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.delegation.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.toItem(r)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Indexer'dan çağrılacak (Adım 6). Şu an stub.
   * op confirmed olunca status güncellemesi.
   */

  async _markConfirmedStub(_opsHash: string, _blockLevel: number, _blockTime: Date): Promise<void> {
    // Adım 6'da implement edilecek
    throw new Error('Not implemented yet (Adım 6)');
  }

  /**
   * Prisma unique violation (P2002) tespiti.
   * Type-safe: Prisma error type'ı import etmek yerine minimal kontrol.
   */
  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    );
  }

  /**
   * Prisma row → public response map.
   * BigInt → string (JSON serialization için).
   * userId leak yok — walletPkh ile değiştirildi.
   */
  private toItem(row: {
    id: string;
    amount: bigint;
    opsHash: string | null;
    status: DelegationStatus;
    blockLevel: number | null;
    blockTime: Date | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: { walletPkh: string };
    baker: { pkh: string; alias: string | null };
  }): DelegationItem {
    return {
      id: row.id,
      walletPkh: row.user.walletPkh,
      bakerPkh: row.baker.pkh,
      bakerAlias: row.baker.alias,
      amount: row.amount.toString(),
      opsHash: row.opsHash,
      status: row.status,
      blockLevel: row.blockLevel,
      blockTime: row.blockTime,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
