import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { PrismaModule } from './prisma.module.js';
import { PrismaService } from './prisma.service.js';

/**
 * PrismaService TDD:
 * - Nest module'a register edildiğinde onModuleInit ile $connect çağrılır
 * - onModuleDestroy ile $disconnect çağrılır
 * - Service üzerinden PrismaClient metotlarına erişilebilir
 *
 * Test DB kullanıyoruz (galatabaker_test) — production DB'ye dokunmamak için.
 */
describe('PrismaService', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL_TEST ??
      'postgresql://galata:***@localhost:5432/galatabaker_test?schema=public';
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    await moduleRef.init(); // triggers onModuleInit
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects to the database and responds to raw query', async () => {
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    expect(result).toEqual([{ ok: 1 }]);
  });

  it('exposes the PrismaClient model delegates', () => {
    expect(prisma.user).toBeDefined();
    expect(prisma.baker).toBeDefined();
    expect(prisma.delegation).toBeDefined();
    expect(prisma.reward).toBeDefined();
    expect(prisma.notification).toBeDefined();
  });

  it('can create and read a User (roundtrip)', async () => {
    const walletPkh = `tz1test${Date.now()}`;
    const created = await prisma.user.create({
      data: { walletPkh },
    });
    expect(created.id).toBeTypeOf('string');
    expect(created.walletPkh).toBe(walletPkh);
    expect(created.role).toBe('USER');

    const found = await prisma.user.findUnique({ where: { walletPkh } });
    expect(found?.id).toBe(created.id);

    // Cleanup
    await prisma.user.delete({ where: { id: created.id } });
  });
});
