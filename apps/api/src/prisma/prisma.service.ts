import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Nest-aware Prisma client wrapper.
 *
 * - onModuleInit'te $connect — uygulama hazır olmadan DB bağlantısı kurulur
 * - onModuleDestroy'da $disconnect — graceful shutdown
 * - Logger: connection events (sadece dev/test — prod'da Fastify Pino loglar)
 *
 * Global module olarak export edilir, böylece diğer service'ler
 * import etmeden inject edebilir (PrismaModule @Global() ile).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }
}
