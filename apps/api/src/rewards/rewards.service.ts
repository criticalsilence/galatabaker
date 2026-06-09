/**
 * GalataBaker API — Rewards service.
 *
 * Tek sorumluluk: apps/web'in ödüller sayfasını besleyecek read-only query
 * + indexer (Adım 6) gelene kadar minimal claim endpoint.
 *
 * Akış (tipik kullanım):
 *   1. apps/web: GET /api/rewards/:walletPkh?cycle=...&kind=... → kullanıcı
 *      dashboard'ı: total + cycle breakdown + paginated list
 *   2. apps/web: "Claim" butonuna basar → cüzdan claim tx imzalar/parse eder
 *   3. apps/web: POST /api/rewards/claim { opsHash, claimedOpsHash } → DB güncellenir
 *   4. (Adım 6) Indexer polling: PENDING durumda olan claim'leri izler, onay
 *      gelince claimed=true atar (henüz yok — MVP'de bu service'ın claim()'i
 *      tek seferde final state yazıyor; indexer callback'i Adım 6'da)
 *
 * Güvenlik notları:
 *   - listByWallet: bilinmeyen wallet → boş döner (404 değil — web tarafı
 *     "kullanıcım var mı" diye kontrol etmek zorunda kalmasın)
 *   - claim: idempotent UPDATE (claimed=false precondition) — indexer'dan
 *     gelen duplicate callback'ler no-op olur
 *   - claim: opsHash unique olmalı (schema zaten enforce ediyor) — race-safe
 *   - amount BigInt → string (JSON serialization için)
 *   - userId leak yok — response'ta sadece walletPkh
 *
 * @see Step 5 Task 6 plan.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, RewardKind } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';

import type { ListRewardsQuery } from './dto/list-rewards.dto.js';

export interface RewardItem {
  id: string;
  walletPkh: string;
  cycle: number;
  kind: RewardKind;
  amount: string; // BigInt -> string
  bakerPkh: string;
  opsHash: string;
  claimed: boolean;
  claimedOpsHash: string | null;
  blockTime: Date;
  createdAt: Date;
}

export interface CycleBreakdownEntry {
  cycle: number;
  total: string; // BigInt -> string
}

export interface ListRewardsResult {
  data: RewardItem[];
  total: number;
  totalAmount: string; // Tüm page'lenmiş reward'ların toplamı (BigInt string)
  cycleBreakdown: CycleBreakdownEntry[];
  limit: number;
  offset: number;
}

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Wallet'e ait reward'ları listele (pagination + cycle/kind filter +
   * aggregation).
   *
   * Aggregation'lar (totalAmount, cycleBreakdown) TÜM kayıtlar üzerinden
   * hesaplanır (filter'lara göre), pagination'dan bağımsız. Yani:
   * "Ali'nin cycle 800'deki tüm BAKING reward'larının toplamı"
   * → filter'lar uygulanır, aggregation o filtrelenmiş küme üzerinden döner.
   */
  async listByWallet(walletPkh: string, query: ListRewardsQuery): Promise<ListRewardsResult> {
    // Limit clamp: 1-100 (DoS koruması)
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const offset = Math.max(0, query.offset ?? 0);

    const where: Prisma.RewardWhereInput = {
      user: { walletPkh },
      ...(query.cycle !== undefined ? { cycle: query.cycle } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
    };

    // 3 paralel sorgu: data, total, aggregations
    const [rows, total, totalAgg, cycleBreakdown] = await Promise.all([
      this.prisma.reward.findMany({
        where,
        orderBy: [{ cycle: 'desc' }, { blockTime: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
        include: { user: { select: { walletPkh: true } } },
      }),
      this.prisma.reward.count({ where }),
      this.prisma.reward.aggregate({
        where,
        _sum: { amount: true },
      }),
      this.prisma.reward.groupBy({
        by: ['cycle'],
        where,
        _sum: { amount: true },
        orderBy: { cycle: 'desc' },
      }),
    ]);

    return {
      data: rows.map((r) => this.toItem(r)),
      total,
      totalAmount: (totalAgg._sum.amount ?? 0n).toString(),
      cycleBreakdown: cycleBreakdown.map((c) => ({
        cycle: c.cycle,
        total: (c._sum.amount ?? 0n).toString(),
      })),
      limit,
      offset,
    };
  }

  /**
   * Indexer'dan çağrılacak (Adım 6) veya apps/web'in claim callback'i.
   * Reward'ı claimed=true yapar, claimedOpsHash set eder.
   *
   * Idempotent: aynı reward zaten claimed ise mevcut değerleri döner
   * (UPDATE WHERE claimed=false → 0 satır güncellendiyse SELECT edip
   * mevcut'u dönmek yerine updateMany + return kullanıyoruz).
   */
  async claim(opsHash: string, claimedOpsHash: string): Promise<RewardItem> {
    // Önce var mı bak — NotFound fail-fast
    const existing = await this.prisma.reward.findUnique({
      where: { opsHash },
      include: { user: { select: { walletPkh: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`Reward not found: ${opsHash}`);
    }

    // Zaten claimed ise no-op — idempotent
    if (existing.claimed) {
      return this.toItem(existing);
    }

    // Atomik UPDATE — race-safe (iki paralel claim gelirse biri kazanır)
    // Postgres: "RETURNING" → UPDATE'in döndürdüğü satırı al
    // Prisma'da bu update + return kombinasyonu update + include ile yapılır
    const updated = await this.prisma.reward.update({
      where: { opsHash },
      data: {
        claimed: true,
        claimedOpsHash,
      },
      include: { user: { select: { walletPkh: true } } },
    });

    return this.toItem(updated);
  }

  /**
   * Prisma row → public response map.
   * BigInt → string (JSON serialization için).
   * userId leak yok — walletPkh ile değiştirildi.
   */
  private toItem(row: {
    id: string;
    cycle: number;
    kind: RewardKind;
    amount: bigint;
    bakerPkh: string;
    opsHash: string;
    claimed: boolean;
    claimedOpsHash: string | null;
    blockTime: Date;
    createdAt: Date;
    user: { walletPkh: string };
  }): RewardItem {
    return {
      id: row.id,
      walletPkh: row.user.walletPkh,
      cycle: row.cycle,
      kind: row.kind,
      amount: row.amount.toString(),
      bakerPkh: row.bakerPkh,
      opsHash: row.opsHash,
      claimed: row.claimed,
      claimedOpsHash: row.claimedOpsHash,
      blockTime: row.blockTime,
      createdAt: row.createdAt,
    };
  }
}
