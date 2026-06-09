/**
 * GalataBaker API — BakersController tests.
 *
 * Strategy: supertest + NestJS test module + real PrismaService
 * (points to galatabaker_test DB via .env). No service mocking — we'd
 * rather test the full HTTP→Controller→Service→Prisma chain so we
 * catch JSON serialization, status codes, and validation errors.
 *
 * Each test creates rows with a unique prefix and cleans them in
 * afterEach to keep parallel runs safe.
 */

import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { BakersController } from './bakers.controller.js';
import { BakersService } from './bakers.service.js';

const RUN = `t${Date.now().toString(36)}`;

// Base58 alphabet: 1-9, a-k, m-z, A-H, J-N, P-Z (no 0, O, I, l).
// Sanitize so Date.now() output (may include l, 0) doesn't break the regex.
const B58 = /[^a-km-zA-HJ-NP-Z1-9]/g;
function validPkh(suffix: string): string {
  const raw = `tz1${RUN}${suffix}`.replace(B58, 'a');
  return raw.padEnd(36, 'a').slice(0, 36);
}

describe('BakersController (HTTP)', () => {
  let app: NestFastifyApplication;
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BakersController],
      providers: [BakersService, PrismaService],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false }),
    );
    app.setGlobalPrefix('api'); // main.ts ile aynı
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    request = supertest(url.replace('[::1]', '127.0.0.1'));
  });

  afterEach(async () => {
    // Clean only our test rows
    const prisma = app.get(PrismaService);
    await prisma.baker.deleteMany({ where: { pkh: { contains: `tz1${RUN}` } } });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/bakers', () => {
    it('returns 200 with paginated list shape', async () => {
      const res = await request.get('/api/bakers');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('sort');
      expect(res.body).toHaveProperty('order');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('respects limit query param (clamped to 1-100)', async () => {
      const low = await request.get('/api/bakers?limit=0');
      const high = await request.get('/api/bakers?limit=9999');
      expect(low.body.limit).toBe(1);
      expect(high.body.limit).toBe(100);
    });

    it('returns 400 on invalid sort field', async () => {
      const res = await request.get('/api/bakers?sort=hackerField');
      expect(res.status).toBe(400);
    });

    it('returns 400 on non-numeric limit', async () => {
      const res = await request.get('/api/bakers?limit=abc');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/bakers/:pkh', () => {
    it('returns 200 with baker detail when found', async () => {
      const pkh = validPkh('detail');
      const prisma = app.get(PrismaService);
      await prisma.baker.create({
        data: {
          pkh,
          alias: 'controller-test',
          status: 'active',
          fee: 0.05,
          capacity: 1000000n,
          totalStake: 1000000n,
          delegatedBalance: 500000n,
          blocksBaked: 0,
          missedBlocks: 0,
        },
      });

      const res = await request.get(`/api/bakers/${pkh}`);
      expect(res.status).toBe(200);
      expect(res.body.pkh).toBe(pkh);
      expect(res.body.alias).toBe('controller-test');
    });

    it('returns 404 when baker not found', async () => {
      const pkh = validPkh('missing');
      const res = await request.get(`/api/bakers/${pkh}`);
      expect(res.status).toBe(404);
    });

    it('returns 400 on invalid pkh format (too short)', async () => {
      const res = await request.get('/api/bakers/short');
      expect(res.status).toBe(400);
    });

    it('returns 400 on invalid pkh format (no tz prefix)', async () => {
      const bad = 'a'.repeat(36);
      const res = await request.get(`/api/bakers/${bad}`);
      expect(res.status).toBe(400);
    });
  });
});
