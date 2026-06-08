import { Controller, Get } from '@nestjs/common';

/**
 * GET /api/health — liveness probe.
 *
 * Container healthcheck, load balancer, uptime monitor için.
 * DB / external servis bağlantısı YOKTUR (readiness check ayrı
 * olacak — apps/api/readiness.controller.ts Adım 2'de).
 */
@Controller('health')
export class HealthController {
  /** Package.json'dan okunacak; şimdilik hard-coded MVP. */
  private static readonly VERSION = '0.0.0';
  private static readonly SERVICE_NAME = 'galatabaker-api';

  @Get()
  get(): {
    status: 'ok';
    uptime: number;
    timestamp: string;
    service: string;
    version: string;
  } {
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      service: HealthController.SERVICE_NAME,
      version: HealthController.VERSION,
    };
  }
}
