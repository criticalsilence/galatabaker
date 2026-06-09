/**
 * GalataBaker API — DelegationsService unit tests.
 *
 * Test verisi: real Postgres test DB, RUN prefix ile izole.
 * Cleanup: afterEach ile RUN prefix'li tüm delegation/user/baker'ları sil.
 *
 * Kritik test'ler:
 *   - create: yeni delegation yaratır (status=PENDING)
 *   - create: opsHash unique constraint — duplicate gelince mevcut döner (idempotent)
 *   - create: user yoksa auto-register
 *   - create: baker yoksa NotFoundException
 *   - listByWallet: createdAt desc, pagination, status filter
 */

import { afterEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';

import { DelegationsService } from './delegations.service.js';

const prisma = new PrismaService();
const service = new DelegationsService(prisma);

const RUN = `t${Date.now()
  .toString(36)
  .replace(/[^a-km-zA-HJ-NP-Z1-9]/g, 'a')}`;

// Base58 sanitizer — zod regex ile uyumlu
const B58 = /[^a-km-zA-HJ-NP-Z1-9]/g;
function validPkh(suffix: string): string {
  return `tz1${RUN}${suffix}`.replace(B58, 'a').padEnd(36, 'a').slice(0, 36);
}

// Tezos op hash: "o" prefix + 50-55 base58 chars (32-byte Blake2b base58 encoded)
function validOpsHash(suffix: string): string {
  return `o${RUN}${suffix}`.replace(B58, 'a').padEnd(52, 'a').slice(0, 52);
}

async function seedBaker(suffix: string): Promise<string> {
  const pkh = validPkh(suffix);
  await prisma.baker.create({
    data: {
      pkh,
      alias: `baker-${suffix}`,
      status: 'active',
      fee: 0.05,
      capacity: 1_000_000_000_000n,
      totalStake: 100_000_000_000_000n,
      delegatedBalance: 50_000_000_000_000n,
      blocksBaked: 0,
      missedBlocks: 0,
    },
  });
  return pkh;
}

describe('DelegationsService', () => {
  afterEach(async () => {
    // Test verimizi sil — sadece RUN prefix'li satırları
    await prisma.delegation.deleteMany({
      where: { user: { walletPkh: { contains: `tz1${RUN}` } } },
    });
    await prisma.user.deleteMany({
      where: { walletPkh: { contains: `tz1${RUN}` } },
    });
    await prisma.baker.deleteMany({
      where: { pkh: { contains: `tz1${RUN}` } },
    });
  });

  describe('create()', () => {
    it('creates a new delegation with status=PENDING', async () => {
      const walletPkh = validPkh('usr');
      const bakerPkh = await seedBaker('bak');
      const opsHash = validOpsHash('first');

      const result = await service.create({
        walletPkh,
        bakerPkh,
        amount: '1000000', // 1 tez in mutez
        opsHash,
      });

      expect(result.walletPkh).toBe(walletPkh);
      expect(result.bakerPkh).toBe(bakerPkh);
      expect(result.amount).toBe('1000000');
      expect(result.opsHash).toBe(opsHash);
      expect(result.status).toBe('PENDING');
      expect(result.bakerAlias).toBe('baker-bak');
    });

    it('is idempotent — same opsHash returns existing delegation', async () => {
      const walletPkh = validPkh('idem');
      const bakerPkh = await seedBaker('idem');
      const opsHash = validOpsHash('idem');

      const first = await service.create({
        walletPkh,
        bakerPkh,
        amount: '5000000',
        opsHash,
      });

      const second = await service.create({
        walletPkh,
        bakerPkh,
        amount: '5000000',
        opsHash,
      });

      // Aynı kayıt (id de aynı)
      expect(second.id).toBe(first.id);
      // DB'de tek satır
      const count = await prisma.delegation.count({ where: { opsHash } });
      expect(count).toBe(1);
    });

    it('auto-registers user when walletPkh does not exist', async () => {
      const walletPkh = validPkh('auto');
      const bakerPkh = await seedBaker('auto');
      const opsHash = validOpsHash('auto');

      // Kullanıcı yok önceden
      const beforeUser = await prisma.user.findUnique({ where: { walletPkh } });
      expect(beforeUser).toBeNull();

      await service.create({
        walletPkh,
        bakerPkh,
        amount: '1000000',
        opsHash,
      });

      // Create sonrası user var
      const afterUser = await prisma.user.findUnique({ where: { walletPkh } });
      expect(afterUser).not.toBeNull();
      expect(afterUser?.role).toBe('USER');
    });

    it('throws NotFoundException when baker does not exist', async () => {
      const walletPkh = validPkh('miss');
      const fakeBakerPkh = validPkh('nonexistent');

      await expect(
        service.create({
          walletPkh,
          bakerPkh: fakeBakerPkh,
          amount: '1000000',
          opsHash: validOpsHash('miss'),
        }),
      ).rejects.toThrow('not found');
    });
  });

  describe('listByWallet()', () => {
    it('returns delegations ordered by createdAt desc with baker alias', async () => {
      const walletPkh = validPkh('list');
      const bakerPkh = await seedBaker('list');
      const ops1 = validOpsHash('list1');
      const ops2 = validOpsHash('list2');

      await service.create({
        walletPkh,
        bakerPkh,
        amount: '1000000',
        opsHash: ops1,
      });
      // Küçük bir gecikme — createdAt sırası net olsun
      await new Promise((r) => setTimeout(r, 10));
      await service.create({
        walletPkh,
        bakerPkh,
        amount: '2000000',
        opsHash: ops2,
      });

      const result = await service.listByWallet(walletPkh, { limit: 20, offset: 0 });

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      // En yeni önce
      expect(result.data[0]?.opsHash).toBe(ops2);
      expect(result.data[1]?.opsHash).toBe(ops1);
      // Baker alias include edildi
      expect(result.data[0]?.bakerAlias).toBe('baker-list');
    });

    it('paginates with limit and offset', async () => {
      const walletPkh = validPkh('page');
      const bakerPkh = await seedBaker('page');

      // 3 delegation oluştur
      for (let i = 0; i < 3; i++) {
        await service.create({
          walletPkh,
          bakerPkh,
          amount: `${1000000 * (i + 1)}`,
          opsHash: validOpsHash(`page${i}`),
        });
        await new Promise((r) => setTimeout(r, 5));
      }

      const page1 = await service.listByWallet(walletPkh, { limit: 2, offset: 0 });
      const page2 = await service.listByWallet(walletPkh, { limit: 2, offset: 2 });

      expect(page1.data).toHaveLength(2);
      expect(page2.data).toHaveLength(1);
      expect(page1.total).toBe(3);
      expect(page2.total).toBe(3);
      // Offset/page ayrı satırlar
      expect(page1.data[0]?.id).not.toBe(page2.data[0]?.id);
    });

    it('filters by status', async () => {
      const walletPkh = validPkh('filt');
      const bakerPkh = await seedBaker('filt');

      // PENDING bir tane
      await service.create({
        walletPkh,
        bakerPkh,
        amount: '1000000',
        opsHash: validOpsHash('pend'),
      });
      // Bir tane de manuel CONFIRMED yap
      await prisma.delegation.create({
        data: {
          user: { connect: { walletPkh } },
          baker: { connect: { pkh: bakerPkh } },
          amount: 2_000_000n,
          opsHash: validOpsHash('conf'),
          status: 'CONFIRMED',
        },
      });

      const pendingOnly = await service.listByWallet(walletPkh, {
        limit: 20,
        offset: 0,
        status: 'PENDING',
      });
      const confirmedOnly = await service.listByWallet(walletPkh, {
        limit: 20,
        offset: 0,
        status: 'CONFIRMED',
      });

      expect(pendingOnly.total).toBe(1);
      expect(pendingOnly.data[0]?.status).toBe('PENDING');
      expect(confirmedOnly.total).toBe(1);
      expect(confirmedOnly.data[0]?.status).toBe('CONFIRMED');
    });

    it('returns empty list for wallet with no delegations', async () => {
      const walletPkh = validPkh('empty');
      const result = await service.listByWallet(walletPkh, { limit: 20, offset: 0 });

      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });

    it('clamps limit to safe range (1-100)', async () => {
      const walletPkh = validPkh('clamp');
      const result1 = await service.listByWallet(walletPkh, { limit: 0, offset: 0 });
      const result2 = await service.listByWallet(walletPkh, { limit: 9999, offset: 0 });

      expect(result1.limit).toBe(1);
      expect(result2.limit).toBe(100);
    });
  });
});
