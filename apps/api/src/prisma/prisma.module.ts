import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

/**
 * Global PrismaModule.
 *
 * @Global() sayesinde diğer modüller PrismaService'i import etmeden
 * inject edebilir:
 *
 *   constructor(private readonly prisma: PrismaService) {}
 *
 * Tek instance (singleton) — connection pooling için doğru.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
