/**
 * GalataBaker API — Bakers service.
 *
 * Tek sorumluluk: baker verisini Prisma'dan okumak.
 * Yazma (register/update) Adım 6+'da (indexer modülü).
 *
 * Güvenlik notları:
 *   - PKH format zaten Prisma katmanında serbest string, ama
 *     controller zod ile tz1-4 36 char kontrolü yapacak.
 *   - Limit clamp 1-100 — DoS koruması.
 *   - Status filtresi: 'closed' baker'lar default gizli (kullanıcı
 *     yanlışlıkla delegate etmesin).
 *   - BigInt -> string'e serialize ediyoruz çünkü JSON.stringify native
 *     BigInt'i desteklemiyor (TypeError fırlatır).
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';

export type BakerSortField = 'totalStake' | 'fee' | 'blocksBaked';
export type SortOrder = 'asc' | 'desc';

export interface ListBakersQuery {
  limit?: number;
  sort?: BakerSortField;
  order?: SortOrder;
}

export interface BakerListItem {
  pkh: string;
  alias: string | null;
  status: string;
  fee: number;
  totalStake: string; // BigInt -> string
  delegatedBalance: string;
  capacity: string;
  blocksBaked: number;
}

export interface ListBakersResult {
  data: BakerListItem[];
  total: number;
  limit: number;
  sort: BakerSortField;
  order: SortOrder;
}

@Injectable()
export class BakersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListBakersQuery): Promise<ListBakersResult> {
    // Clamp limit: min 1, max 100 (DoS / oversize payload koruması)
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const sort = query.sort ?? 'totalStake';
    const order = query.order ?? 'desc';

    const where: Prisma.BakerWhereInput = {
      status: { not: 'closed' },
    };

    const [rows, total] = await Promise.all([
      this.prisma.baker.findMany({
        where,
        orderBy: { [sort]: order },
        take: limit,
        select: {
          pkh: true,
          alias: true,
          status: true,
          fee: true,
          totalStake: true,
          delegatedBalance: true,
          capacity: true,
          blocksBaked: true,
        },
      }),
      this.prisma.baker.count({ where }),
    ]);

    return {
      data: rows.map((b) => ({
        pkh: b.pkh,
        alias: b.alias,
        status: b.status,
        fee: Number(b.fee),
        totalStake: b.totalStake.toString(),
        delegatedBalance: b.delegatedBalance.toString(),
        capacity: b.capacity.toString(),
        blocksBaked: b.blocksBaked,
      })),
      total,
      limit,
      sort,
      order,
    };
  }

  async getByPkh(pkh: string): Promise<BakerListItem> {
    const baker = await this.prisma.baker.findUnique({
      where: { pkh },
      select: {
        pkh: true,
        alias: true,
        status: true,
        fee: true,
        totalStake: true,
        delegatedBalance: true,
        capacity: true,
        blocksBaked: true,
      },
    });

    if (!baker) {
      // 404 — pkh echo etmiyoruz (kullanıcı input'unu yansıtmıyoruz)
      throw new NotFoundException('Baker not found');
    }

    return {
      pkh: baker.pkh,
      alias: baker.alias,
      status: baker.status,
      fee: Number(baker.fee),
      totalStake: baker.totalStake.toString(),
      delegatedBalance: baker.delegatedBalance.toString(),
      capacity: baker.capacity.toString(),
      blocksBaked: baker.blocksBaked,
    };
  }
}
