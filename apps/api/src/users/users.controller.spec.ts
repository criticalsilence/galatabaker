/**
 * GalataBaker API — UsersController tests.
 *
 * Full HTTP chain: supertest → NestJS → Controller → Service → Prisma.
 * No mocking — real DB, real validation, real serialization.
 */

import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

const RUN = `t${Date.now()
  .toString(36)
  .replace(/[^a-km-zA-HJ-NP-Z1-9]/g, 'a')}`;
const B58 = /[^a-km-zA-HJ-NP-Z1-9]/g;
function validPkh(suffix: string): string {
  return `tz1${RUN}${suffix}`.replace(B58, 'a').padEnd(36, 'a').slice(0, 36);
}

describe('UsersController (HTTP)', () => {
  let app: NestFastifyApplication;
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [UsersService, PrismaService],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false }),
    );
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    request = supertest(url.replace('[::1]', '127.0.0.1'));
  });

  afterEach(async () => {
    const prisma = app.get(PrismaService);
    await prisma.user.deleteMany({
      where: {
        OR: [{ walletPkh: { contains: `tz1${RUN}` } }, { email: { contains: RUN } }],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/users/register', () => {
    it('creates user with walletPkh only (201/200) and returns masked response', async () => {
      const pkh = validPkh('new');
      const res = await request.post('/api/users/register').send({ walletPkh: pkh });
      expect([200, 201]).toContain(res.status);
      expect(res.body.walletPkh).toBe(pkh);
      expect(res.body.role).toBe('USER');
      expect(res.body.emailMasked).toBeNull();
      // Full email ASLA dönmemeli
      expect(res.body.email).toBeUndefined();
    });

    it('is idempotent — second call returns same user id', async () => {
      const pkh = validPkh('idem');
      const r1 = await request.post('/api/users/register').send({ walletPkh: pkh });
      const r2 = await request.post('/api/users/register').send({ walletPkh: pkh });
      expect(r1.body.id).toBe(r2.body.id);
    });

    it('lowercases email and masks it in response', async () => {
      const pkh = validPkh('em');
      const res = await request.post('/api/users/register').send({
        walletPkh: pkh,
        email: 'MixedCase@Example.COM',
      });
      expect(res.status).toBeLessThan(300);
      expect(res.body.emailMasked).toBe('m***@example.com');
    });

    it('rejects missing walletPkh (400)', async () => {
      const res = await request.post('/api/users/register').send({ email: 'a@b.com' });
      expect(res.status).toBe(400);
    });

    it('rejects invalid pkh format (400)', async () => {
      const res = await request.post('/api/users/register').send({ walletPkh: 'short' });
      expect(res.status).toBe(400);
    });

    it('rejects invalid email (400)', async () => {
      const pkh = validPkh('bad-email');
      const res = await request.post('/api/users/register').send({
        walletPkh: pkh,
        email: 'not-an-email',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/users/:walletPkh', () => {
    it('returns 200 with masked user data when found', async () => {
      const pkh = validPkh('get');
      await request.post('/api/users/register').send({
        walletPkh: pkh,
        email: 'find@me.com',
        telegramChatId: '1234567890',
      });

      const res = await request.get(`/api/users/${pkh}`);
      expect(res.status).toBe(200);
      expect(res.body.walletPkh).toBe(pkh);
      expect(res.body.emailMasked).toBe('f***@me.com');
      expect(res.body.telegramChatIdMasked).toBe('*****67890');
    });

    it('returns 404 when user not found', async () => {
      const pkh = validPkh('missing');
      const res = await request.get(`/api/users/${pkh}`);
      expect(res.status).toBe(404);
    });

    it('returns 400 on invalid pkh format', async () => {
      const res = await request.get('/api/users/short');
      expect(res.status).toBe(400);
    });
  });
});
