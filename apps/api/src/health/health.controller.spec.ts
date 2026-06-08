import { Test } from '@nestjs/testing';
import { describe, it, expect } from 'vitest';

import { HealthController } from './health.controller.js';

/**
 * Health endpoint TDD:
 * - GET /api/health → { status: 'ok', uptime, timestamp, service, version }
 * - uptime pozitif (process başladıktan sonra)
 * - timestamp geçerli ISO date
 * - service 'galatabaker-api'
 */
describe('HealthController', () => {
  async function buildController(): Promise<HealthController> {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    return moduleRef.get(HealthController);
  }

  it('returns ok status with required fields', async () => {
    const ctrl = await buildController();
    const result = ctrl.get();
    expect(result.status).toBe('ok');
    expect(typeof result.uptime).toBe('number');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(result.service).toBe('galatabaker-api');
    expect(result.version).toBe('0.0.0');
  });

  it('returns a valid ISO timestamp', () => {
    const result = new HealthController().get();
    expect(typeof result.timestamp).toBe('string');
    expect(Number.isFinite(Date.parse(result.timestamp))).toBe(true);
    // Recent (<5s ago) — sanity check
    const ts = Date.parse(result.timestamp);
    expect(Math.abs(Date.now() - ts)).toBeLessThan(5000);
  });
});
