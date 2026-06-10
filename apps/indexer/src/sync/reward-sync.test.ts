import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../db';

import { RewardSync } from './reward-sync';

vi.mock('../db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    reward: { upsert: vi.fn() },
  },
}));

vi.mock('../state', () => ({
  getLastSeen: vi.fn().mockResolvedValue(0),
  setLastSeen: vi.fn().mockResolvedValue(undefined),
}));

describe('RewardSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips ops whose recipient is not a registered user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const tzkt = {
      get: vi
        .fn()
        .mockResolvedValueOnce([{ level: 1000 }])
        .mockResolvedValueOnce([
          {
            id: 1,
            level: 999,
            timestamp: '2026-06-01T00:00:00Z',
            baker: { alias: 'Galata', address: 'tz1galata' },
            proposer: null,
            recipient: 'tz1unknown',
            reward: '1000000',
            type: 'rewards',
          },
        ])
        // cycle lookup
        .mockResolvedValueOnce([{ index: 100 }]),
    };

    const r = await new RewardSync(tzkt, 100).run();
    expect(r.skipped).toBe(1);
    expect(r.inserted).toBe(0);
    expect(prisma.reward.upsert).not.toHaveBeenCalled();
  });

  it('inserts a reward row for a registered user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u-1',
      walletPkh: 'tz1user',
      email: null,
      telegramChatId: null,
      emailVerified: false,
      telegramVerified: false,
      role: 'USER',
      preferences: null,
      consentGivenAt: null,
      consentVersion: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.reward.upsert).mockResolvedValue({} as never);

    const tzkt = {
      get: vi
        .fn()
        .mockResolvedValueOnce([{ level: 2000 }])
        .mockResolvedValueOnce([
          {
            id: 42,
            level: 1999,
            timestamp: '2026-06-02T00:00:00Z',
            baker: { alias: 'Galata', address: 'tz1galata' },
            proposer: null,
            recipient: 'tz1user',
            reward: '2500000',
          },
        ])
        .mockResolvedValueOnce([{ index: 200 }]),
    };

    const r = await new RewardSync(tzkt, 100).run();
    expect(r.inserted).toBe(1);
    expect(prisma.reward.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { opsHash: 'tzkt:42' },
        create: expect.objectContaining({
          userId: 'u-1',
          bakerPkh: 'tz1galata',
          kind: 'BAKING',
          amount: 2_500_000n,
        }),
      }),
    );
  });
});
