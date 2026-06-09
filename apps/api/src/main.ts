import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { config } from 'dotenv';

import { AppModule } from './app.module.js';

/**
 * Bootstrap.
 *
 * - Fastify adapter: Express'ten 2-3x hızlı, daha düşük memory
 * - Global prefix 'api': tüm route'lar /api/* altında
 * - Port 3001: apps/web 3000, octez indexer ileride 3002
 * - 0.0.0.0 bind: docker container'dan erişilebilir
 *
 * Env yükleme: dotenv kütüphanesi kullanıyoruz (Node 22'nin built-in
 * process.loadEnvFile()'undan farklı — Node 22 URL password'larını
 * security için redakt ediyor, bu da Prisma'nın DATABASE_URL'i okumasını
 * bozar). dotenv orjinal değerleri korur.
 *
 * Production'da env inject edilir (Docker, K8s, Railway); .env yoksa
 * sessizce geçer — config({ path: undefined }) no-op.
 */
async function bootstrap(): Promise<void> {
  // .env'i process.env'e yükle. Dosya yoksa hata vermez (no-op).
  config();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true, // NestJS logger integration (error/warn/log)
      trustProxy: true,
    }),
  );

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? [
      'http://localhost:3000', // apps/web dev
      'http://localhost:3002', // apps/web alt port
    ],
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`[GalataBaker API] Listening on http://localhost:${port}/api (pid ${process.pid})`);
}

bootstrap().catch((err: unknown) => {
  console.error('[GalataBaker API] Bootstrap failed', err);
  process.exit(1);
});
