/**
 * GalataBaker API — UsersService unit tests.
 *
 * Test verisi: real Postgres test DB, RUN prefix ile izole.
 * Cleanup: afterEach ile RUN prefix'li tüm user'ları sil.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';

import { UsersService } from './users.service.js';

const prisma = new PrismaService();
const service = new UsersService(prisma);

const RUN = `t${Date.now()
  .toString(36)
  .replace(/[^a-km-zA-HJ-NP-Z1-9]/g, 'a')}`;

// Base58 sanitizer — zod regex ile uyumlu (PII mask testi için de lazım)
const B58 = /[^a-km-zA-HJ-NP-Z1-9]/g;
function validPkh(suffix: string): string {
  return `tz1${RUN}${suffix}`.replace(B58, 'a').padEnd(36, 'a').slice(0, 36);
}

describe('UsersService', () => {
  afterEach(async () => {
    // Test user'larımızı sil (walletPkh veya email RUN içeriyor)
    await prisma.user.deleteMany({
      where: {
        OR: [{ walletPkh: { contains: `tz1${RUN}` } }, { email: { contains: RUN } }],
      },
    });
  });

  describe('register()', () => {
    it('creates a new user with minimal data', async () => {
      const pkh = validPkh('min');
      const user = await service.register({ walletPkh: pkh });

      expect(user.walletPkh).toBe(pkh);
      expect(user.role).toBe('USER');
      expect(user.emailMasked).toBeNull();
      expect(user.telegramChatIdMasked).toBeNull();
    });

    it('is idempotent — same wallet returns same user (no duplicate)', async () => {
      const pkh = validPkh('idem');
      const first = await service.register({ walletPkh: pkh });
      const second = await service.register({ walletPkh: pkh });

      expect(first.walletPkh).toBe(second.walletPkh);
      expect(first.id).toBe(second.id);
      // Tek satır olmalı
      const count = await prisma.user.count({ where: { walletPkh: pkh } });
      expect(count).toBe(1);
    });

    it('updates email on second register (idempotent upsert)', async () => {
      const pkh = validPkh('upd');
      await service.register({ walletPkh: pkh, email: 'alice@example.com' });
      const updated = await service.register({ walletPkh: pkh, email: 'ALICE@EXAMPLE.COM' });

      // Email lowercase normalize edildi
      expect(updated.emailMasked).toBe('a***@example.com');
    });

    it('preserves existing email when not provided in second call', async () => {
      const pkh = validPkh('pres');
      await service.register({ walletPkh: pkh, email: 'bob@example.com' });
      // İkinci çağrıda email yok — eskisi kalmalı
      const user = await service.register({ walletPkh: pkh });
      expect(user.emailMasked).toBe('b***@example.com');
    });

    it('masks telegram chat id keeping last 5 digits', async () => {
      const pkh = validPkh('tg');
      const user = await service.register({ walletPkh: pkh, telegramChatId: '1234567890' });
      expect(user.telegramChatIdMasked).toBe('*****67890');
    });
  });

  describe('findByPkh()', () => {
    it('returns user with masked PII when found', async () => {
      const pkh = validPkh('find');
      await service.register({ walletPkh: pkh, email: 'carol@test.org' });
      const user = await service.findByPkh(pkh);

      expect(user.walletPkh).toBe(pkh);
      expect(user.emailMasked).toBe('c***@test.org');
      // Full email asla dönmez
      expect((user as unknown as { email?: string }).email).toBeUndefined();
    });

    it('throws NotFoundException when user not found', async () => {
      const pkh = validPkh('miss');
      await expect(service.findByPkh(pkh)).rejects.toThrow('not found');
    });
  });
});
