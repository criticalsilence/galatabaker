/**
 * GalataBaker API — RewardsService unit tests.
 *
 * Test verisi: real Postgres test DB, RUN prefix ile izole.
 * Cleanup: afterEach ile RUN prefix'li tüm reward/user'ları sil.
 *
 * Kritik test'ler:
 *   - listByWallet: cycle desc + pagination + kind/cycle filter
 *   - listByWallet: totalAmount BigInt string aggregation
 *   - listByWallet: cycleBreakdown aggregation (per-cycle total)
 *   - listByWallet: empty for unknown wallet (no throw)
 *   - listByWallet: limit clamp (1-100)
 *   - claim: mark claimed=true + claimedOpsHash set
 *   - claim: idempotent (already claimed → returns same)
 *   - claim: NotFoundException when opsHash not found
 *
 * Not: indexer (Adım 6) ve POST /claim MVP'de stub kalabilir — bu test'ler
 * service katmanını zaten izole olarak doğruluyor (DB'ye direkt seed ile
 * reward satırı yazıyoruz, controller bu stub'ı çağırır).
 */

import { afterEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';

import { RewardsService } from './rewards.service.js';

const prisma = new PrismaService();
const service = new RewardsService(prisma);

const RUN = `t${Date.now()
  .toString(36)
  .replace(/[^a-km-zA-HJ-NP-Z1-9]/g, 'a')}`;

// Base58 sanitizer — zod regex ile uyumlu
const B58 = /[^a-km-zA-HJ-NP-Z1-9]/g;
function validPkh(suffix: string): string {
  return `tz1${RUN}${suffix}`.replace(B58, 'a').padEnd(36, 'a').slice(0, 36);
}

function validOpsHash(suffix: string): string {
  return `o${RUN}${suffix}`.replace(B58, 'a').padEnd(52, 'a').slice(0, 52);
}

async function seedUser(suffix: string): Promise<string> {
  const pkh = validPkh(suffix);
  await prisma.user.create({ data: { walletPkh: pkh } });
  return pkh;
}

async function seedReward(
  walletPkh: string,
  args: {
    cycle: number;
    kind: 'BAKING' | 'ENDORSING' | 'FEE' | 'DENUNCIATION';
    amount: bigint;
    opsHash: string;
    bakerPkh: string;
    blockTime: Date;
  },
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { walletPkh } });
  await prisma.reward.create({
    data: {
      userId: user.id,
      cycle: args.cycle,
      kind: args.kind,
      amount: args.amount,
      bakerPkh: args.bakerPkh,
      opsHash: args.opsHash,
      blockTime: args.blockTime,
    },
  });
}

describe('RewardsService', () => {
  afterEach(async () => {
    // Test verimizi sil — sadece RUN prefix'li satırları
    await prisma.reward.deleteMany({
      where: { user: { walletPkh: { contains: `tz1${RUN}` } } },
    });
    await prisma.user.deleteMany({
      where: { walletPkh: { contains: `tz1${RUN}` } },
    });
  });

  describe('listByWallet()', () => {
    it('returns empty list for unknown wallet (no throw)', async () => {
      const walletPkh = validPkh('none');

      const result = await service.listByWallet(walletPkh, { limit: 20, offset: 0 });

      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
      expect(result.totalAmount).toBe('0');
      expect(result.cycleBreakdown).toEqual([]);
    });

    it('returns rewards ordered by cycle desc, blockTime desc', async () => {
      const walletPkh = await seedUser('ord');
      const bakerPkh = validPkh('bak');

      // cycle 800, baking
      await seedReward(walletPkh, {
        cycle: 800,
        kind: 'BAKING',
        amount: 1_000_000n,
        opsHash: validOpsHash('b800'),
        bakerPkh,
        blockTime: new Date('2026-01-01T00:00:00Z'),
      });
      // cycle 801, endorsing — yeni cycle
      await seedReward(walletPkh, {
        cycle: 801,
        kind: 'ENDORSING',
        amount: 500_000n,
        opsHash: validOpsHash('e801'),
        bakerPkh,
        blockTime: new Date('2026-01-02T00:00:00Z'),
      });

      const result = await service.listByWallet(walletPkh, { limit: 20, offset: 0 });

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      // En yeni cycle önce
      expect(result.data[0]?.cycle).toBe(801);
      expect(result.data[0]?.kind).toBe('ENDORSING');
      expect(result.data[1]?.cycle).toBe(800);
    });

    it('paginates with limit and offset', async () => {
      const walletPkh = await seedUser('pag');
      const bakerPkh = validPkh('bak');

      for (let i = 0; i < 3; i++) {
        await seedReward(walletPkh, {
          cycle: 800 + i,
          kind: 'BAKING',
          amount: BigInt(1_000_000 * (i + 1)),
          opsHash: validOpsHash(`p${i}`),
          bakerPkh,
          blockTime: new Date(2026, 0, i + 1),
        });
      }

      const page1 = await service.listByWallet(walletPkh, { limit: 2, offset: 0 });
      const page2 = await service.listByWallet(walletPkh, { limit: 2, offset: 2 });

      expect(page1.data).toHaveLength(2);
      expect(page2.data).toHaveLength(1);
      expect(page1.total).toBe(3);
      expect(page2.total).toBe(3);
      expect(page1.data[0]?.id).not.toBe(page2.data[0]?.id);
    });

    it('filters by cycle', async () => {
      const walletPkh = await seedUser('cyc');
      const bakerPkh = validPkh('bak');

      await seedReward(walletPkh, {
        cycle: 800,
        kind: 'BAKING',
        amount: 1_000_000n,
        opsHash: validOpsHash('c800'),
        bakerPkh,
        blockTime: new Date('2026-01-01T00:00:00Z'),
      });
      await seedReward(walletPkh, {
        cycle: 801,
        kind: 'BAKING',
        amount: 2_000_000n,
        opsHash: validOpsHash('c801'),
        bakerPkh,
        blockTime: new Date('2026-01-02T00:00:00Z'),
      });

      const cycle800 = await service.listByWallet(walletPkh, {
        limit: 20,
        offset: 0,
        cycle: 800,
      });

      expect(cycle800.total).toBe(1);
      expect(cycle800.data[0]?.cycle).toBe(800);
    });

    it('filters by kind', async () => {
      const walletPkh = await seedUser('knd');
      const bakerPkh = validPkh('bak');

      await seedReward(walletPkh, {
        cycle: 800,
        kind: 'BAKING',
        amount: 1_000_000n,
        opsHash: validOpsHash('kb'),
        bakerPkh,
        blockTime: new Date('2026-01-01T00:00:00Z'),
      });
      await seedReward(walletPkh, {
        cycle: 800,
        kind: 'ENDORSING',
        amount: 500_000n,
        opsHash: validOpsHash('ke'),
        bakerPkh,
        blockTime: new Date('2026-01-01T00:00:00Z'),
      });

      const bakingOnly = await service.listByWallet(walletPkh, {
        limit: 20,
        offset: 0,
        kind: 'BAKING',
      });

      expect(bakingOnly.total).toBe(1);
      expect(bakingOnly.data[0]?.kind).toBe('BAKING');
    });

    it('aggregates totalAmount as BigInt string', async () => {
      const walletPkh = await seedUser('tot');
      const bakerPkh = validPkh('bak');

      await seedReward(walletPkh, {
        cycle: 800,
        kind: 'BAKING',
        amount: 1_000_000n,
        opsHash: validOpsHash('t1'),
        bakerPkh,
        blockTime: new Date('2026-01-01T00:00:00Z'),
      });
      await seedReward(walletPkh, {
        cycle: 800,
        kind: 'ENDORSING',
        amount: 500_000n,
        opsHash: validOpsHash('t2'),
        bakerPkh,
        blockTime: new Date('2026-01-01T00:00:00Z'),
      });
      await seedReward(walletPkh, {
        cycle: 801,
        kind: 'BAKING',
        amount: 2_500_000n,
        opsHash: validOpsHash('t3'),
        bakerPkh,
        blockTime: new Date('2026-01-02T00:00:00Z'),
      });

      const result = await service.listByWallet(walletPkh, { limit: 20, offset: 0 });

      // 1_000_000 + 500_000 + 2_500_000 = 4_000_000
      expect(result.totalAmount).toBe('4000000');
    });

    it('builds cycleBreakdown aggregation', async () => {
      const walletPkh = await seedUser('brk');
      const bakerPkh = validPkh('bak');

      await seedReward(walletPkh, {
        cycle: 800,
        kind: 'BAKING',
        amount: 1_000_000n,
        opsHash: validOpsHash('b1'),
        bakerPkh,
        blockTime: new Date('2026-01-01T00:00:00Z'),
      });
      await seedReward(walletPkh, {
        cycle: 800,
        kind: 'ENDORSING',
        amount: 500_000n,
        opsHash: validOpsHash('b2'),
        bakerPkh,
        blockTime: new Date('2026-01-01T00:00:00Z'),
      });
      await seedReward(walletPkh, {
        cycle: 801,
        kind: 'BAKING',
        amount: 2_500_000n,
        opsHash: validOpsHash('b3'),
        bakerPkh,
        blockTime: new Date('2026-01-02T00:00:00Z'),
      });

      const result = await service.listByWallet(walletPkh, { limit: 20, offset: 0 });

      // Yeni cycle önce
      expect(result.cycleBreakdown).toEqual([
        { cycle: 801, total: '2500000' },
        { cycle: 800, total: '1500000' },
      ]);
    });

    it('clamps limit to safe range (1-100)', async () => {
      const walletPkh = validPkh('clmp');

      const r1 = await service.listByWallet(walletPkh, { limit: 0, offset: 0 });
      const r2 = await service.listByWallet(walletPkh, { limit: 9999, offset: 0 });

      expect(r1.limit).toBe(1);
      expect(r2.limit).toBe(100);
    });
  });

  describe('claim()', () => {
    it('marks reward as claimed with claimedOpsHash', async () => {
      const walletPkh = await seedUser('clm');
      const bakerPkh = validPkh('bak');
      const opsHash = validOpsHash('clm');
      await seedReward(walletPkh, {
        cycle: 800,
        kind: 'BAKING',
        amount: 1_000_000n,
        opsHash,
        bakerPkh,
        blockTime: new Date('2026-01-01T00:00:00Z'),
      });

      const claimedOpsHash = validOpsHash('txn');
      const result = await service.claim(opsHash, claimedOpsHash);

      expect(result.claimed).toBe(true);
      expect(result.claimedOpsHash).toBe(claimedOpsHash);

      // DB'de güncellendi mi?
      const dbRow = await prisma.reward.findUniqueOrThrow({ where: { opsHash } });
      expect(dbRow.claimed).toBe(true);
      expect(dbRow.claimedOpsHash).toBe(claimedOpsHash);
    });

    it('is idempotent — already claimed returns existing', async () => {
      const walletPkh = await seedUser('idem');
      const bakerPkh = validPkh('bak');
      const opsHash = validOpsHash('idem');
      await seedReward(walletPkh, {
        cycle: 800,
        kind: 'BAKING',
        amount: 1_000_000n,
        opsHash,
        bakerPkh,
        blockTime: new Date('2026-01-01T00:00:00Z'),
      });

      const firstClaim = validOpsHash('c1');
      const secondClaim = validOpsHash('c2');

      const first = await service.claim(opsHash, firstClaim);
      // İkinci claim aynı reward üzerinde — claimed zaten true, farklı
      // claimedOpsHash ile gelirse no-op (idempotent: hangi tx hash ile
      // claim edildiği önemli, sonraki callback'ler aynı kabul edilir)
      const second = await service.claim(opsHash, secondClaim);

      expect(first.claimedOpsHash).toBe(firstClaim);
      // İkinci çağrı ilk claim'i ezmeli mi, no-op mu?
      // MVP kararı: ilk claim kazanır (DB'de UPDATE WHERE claimed=false).
      // Bu sayede indexer'dan gelen duplicate callback'ler no-op olur.
      expect(second.claimedOpsHash).toBe(firstClaim);
      expect(second.claimed).toBe(true);
    });

    it('throws NotFoundException when opsHash not found', async () => {
      await expect(service.claim(validOpsHash('miss'), validOpsHash('txn'))).rejects.toThrow(
        'not found',
      );
    });
  });
});
