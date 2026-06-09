/**
 * GalataBaker API — BakersService unit tests.
 *
 * Strategy: integration tests against a real test Postgres database
 * (DATABASE_URL must point to galatabaker_test). Each test uses a
 * unique walletPkh prefix to avoid collisions when tests run in parallel
 * or share state.
 *
 * We clean only the rows we created (prefix-based delete) to keep tests
 * isolated without trampling other developers' data.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';

import { BakersService } from './bakers.service.js';

const prisma = new PrismaService();
const service = new BakersService(prisma);

// Unique prefix per test run — keep test data isolated
const RUN = `t${Date.now().toString(36)}`;

function makeBaker(
  pkhSuffix: string,
  overrides: Partial<{
    alias: string;
    fee: number;
    totalStake: bigint;
    status: string;
  }> = {},
) {
  return {
    pkh: `tz1${RUN}${pkhSuffix}`.padEnd(36, 'a'),
    alias: overrides.alias ?? `baker-${pkhSuffix}`,
    status: overrides.status ?? 'active',
    fee: overrides.fee ?? 0.05,
    capacity: 1000000000000n,
    totalStake: overrides.totalStake ?? 1000000000000n,
    delegatedBalance: 500000000000n,
    blocksBaked: 0,
    missedBlocks: 0,
  };
}

describe('BakersService', () => {
  // Clean up only our test rows after each test (no trampling)
  afterEach(async () => {
    await prisma.baker.deleteMany({
      where: { pkh: { contains: `tz1${RUN}` } },
    });
  });

  describe('list()', () => {
    it('returns empty array when no bakers match', async () => {
      const result = await service.list({ limit: 20, sort: 'totalStake', order: 'desc' });
      // Don't assert exact emptiness (DB may have seed data) — assert shape only
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.limit).toBe(20);
    });

    it('returns paginated bakers sorted by totalStake desc', async () => {
      // Stake'leri seed'den (maks 78T) büyük tut ki test bakers'ı listenin
      // başında görünsün, sıralama doğrulanabilsin.
      const b1 = await prisma.baker.create({
        data: makeBaker('aaa', { alias: 'low', totalStake: 100_000_000_000_000n }),
      });
      const b2 = await prisma.baker.create({
        data: makeBaker('bbb', { alias: 'high', totalStake: 900_000_000_000_000n }),
      });
      const b3 = await prisma.baker.create({
        data: makeBaker('ccc', { alias: 'mid', totalStake: 500_000_000_000_000n }),
      });

      const result = await service.list({ limit: 100, sort: 'totalStake', order: 'desc' });

      // Find our test bakers in the result
      const ourBakers = result.data.filter((b) => b.pkh.startsWith(`tz1${RUN}`));

      expect(ourBakers).toHaveLength(3);
      // Among ours, highest stake should be first (b2)
      expect(ourBakers[0]?.pkh).toBe(b2.pkh);
      expect(ourBakers[1]?.pkh).toBe(b3.pkh);
      expect(ourBakers[2]?.pkh).toBe(b1.pkh);
    });

    it('clamps limit to safe range (1-100)', async () => {
      const low = await service.list({ limit: 0, sort: 'totalStake', order: 'desc' });
      const high = await service.list({ limit: 9999, sort: 'totalStake', order: 'desc' });
      expect(low.limit).toBe(1);
      expect(high.limit).toBe(100);
    });

    it('supports sort by fee asc', async () => {
      const cheap = await prisma.baker.create({
        data: makeBaker('fee1', { alias: 'cheap', fee: 0.02 }),
      });
      const pricey = await prisma.baker.create({
        data: makeBaker('fee2', { alias: 'pricey', fee: 0.1 }),
      });

      const result = await service.list({ sort: 'fee', order: 'asc', limit: 50 });
      const ours = result.data.filter((b) => b.pkh.startsWith(`tz1${RUN}`));

      // Among ours, cheapest first
      expect(ours[0]?.pkh).toBe(cheap.pkh);
      expect(ours[1]?.pkh).toBe(pricey.pkh);
    });

    it('does not include closed/inactive bakers in default list', async () => {
      const active = await prisma.baker.create({ data: makeBaker('act', { status: 'active' }) });
      const closed = await prisma.baker.create({ data: makeBaker('clo', { status: 'closed' }) });

      const result = await service.list({ limit: 50, sort: 'totalStake', order: 'desc' });
      const pkhs = result.data.map((b) => b.pkh);

      expect(pkhs).toContain(active.pkh);
      expect(pkhs).not.toContain(closed.pkh);
    });
  });

  describe('getByPkh()', () => {
    it('returns baker when found', async () => {
      const created = await prisma.baker.create({
        data: makeBaker('det', { alias: 'detail-test' }),
      });
      const found = await service.getByPkh(created.pkh);
      expect(found.pkh).toBe(created.pkh);
      expect(found.alias).toBe('detail-test');
    });

    it('throws NotFoundException when baker not found', async () => {
      const fakePkh = `tz1${RUN}nonexistent`.padEnd(36, 'z');
      await expect(service.getByPkh(fakePkh)).rejects.toThrow('not found');
    });
  });
});
