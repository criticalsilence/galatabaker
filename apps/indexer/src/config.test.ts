import { beforeEach, describe, expect, it } from 'vitest';

import { loadConfig } from './config';

describe('loadConfig', () => {
  beforeEach(() => {
    process.env.LOG_LEVEL = 'info';
  });

  it('parses full env', () => {
    const cfg = loadConfig();
    expect(cfg.TZKT_BASE_URL).toMatch(/^https?:\/\//);
    expect(cfg.INTERVAL_MS).toBeGreaterThan(0);
    expect(cfg.BATCH_SIZE).toBeGreaterThan(0);
  });

  it('throws on missing DATABASE_URL', () => {
    const orig = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(() => loadConfig()).toThrow(/DATABASE_URL/);
    process.env.DATABASE_URL = orig;
  });
});
