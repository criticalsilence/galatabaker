import { describe, expect, it, vi } from 'vitest';

import { runMain } from './main';

vi.mock('./sync/baker-sync', () => ({
  BakerSync: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({ scanned: 5, upserted: 5 }),
  })),
}));
vi.mock('./sync/delegation-sync', () => ({
  DelegationSync: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({ scanned: 0, confirmed: 0, failed: 0 }),
  })),
}));
vi.mock('./sync/reward-sync', () => ({
  RewardSync: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({ scanned: 0, inserted: 0, skipped: 0 }),
  })),
}));

describe('runMain', () => {
  it('runs one tick then exits on SIGTERM', async () => {
    process.env.TZKT_BASE_URL = 'https://api.example.test';
    process.env.DATABASE_URL = 'postgresql://x/y';
    process.env.INTERVAL_MS = '10';
    process.env.LOG_LEVEL = 'info';

    const p = runMain();

    // Let it tick once
    await new Promise((r) => setTimeout(r, 25));

    // Send SIGTERM-equivalent
    process.emit('SIGTERM' as NodeJS.Signals);

    const r = await p;
    expect(r.reason).toBe('shutdown');
    expect(r.ticks).toBeGreaterThanOrEqual(1);
  });
});
