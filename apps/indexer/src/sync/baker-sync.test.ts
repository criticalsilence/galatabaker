import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../db';

import { BakerSync } from './baker-sync';

vi.mock('../db', () => ({
  prisma: {
    baker: { upsert: vi.fn().mockResolvedValue({}) },
  },
}));

describe('BakerSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('upserts one row per delegate', async () => {
    const tzkt = {
      get: vi.fn().mockResolvedValue([
        {
          address: 'tz1active',
          alias: 'Galata',
          active: true,
          fee: 500,
          stakingBalance: '1000000000000',
          delegatedBalance: '500000000000',
          limitOfStakingBalance: '9000000000000',
          blocksBaked: 42,
          blocksMissed: 0,
        },
        {
          address: 'tz1closed',
          alias: 'Old',
          active: false,
          fee: 1000,
          stakingBalance: '0',
          delegatedBalance: '0',
          limitOfStakingBalance: '0',
          blocksBaked: 0,
          blocksMissed: 100,
        },
      ]),
    };

    const r = await new BakerSync(tzkt).run();
    expect(r.scanned).toBe(2);
    expect(r.upserted).toBe(2);
    expect(prisma.baker.upsert).toHaveBeenCalledTimes(2);

    const first = vi.mocked(prisma.baker.upsert).mock.calls[0]![0];
    expect(first.where).toEqual({ pkh: 'tz1active' });
    expect(first.create?.status).toBe('active');
    expect(first.create?.fee).toBe(500);

    const second = vi.mocked(prisma.baker.upsert).mock.calls[1]![0];
    expect(second.where).toEqual({ pkh: 'tz1closed' });
    expect(second.create?.status).toBe('closed');
  });
});
