/**
 * Public API surface (library entry point).
 *
 * Henüz dışarıya açık bir şey yok — apps/api monolitik binary
 * olarak çalışıyor (apps/api/dist/main.js). Diğer workspace
 * paketleri sadece Prisma client'ı import edebilir (Adım 2'de).
 */
export { AppModule } from './app.module.js';
export { HealthModule } from './health/health.module.js';
export { HealthController } from './health/health.controller.js';
