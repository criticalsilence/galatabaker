import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../db';

import { DelegationSync } from './delegation-sync';

vi.mock('../db', () => ({
  prisma: {
    delegation: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// stub state helpers so we don't need a real DB
vi.mock('../state', () => ({
  getLastSeen: vi.fn().mockResolvedValue(0),
  setLastSeen: vi.fn().mockResolvedValue(undefined),
}));

describe('DelegationSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirms a pending delegation when op is applied', async () => {
    vi.mocked(prisma.delegation.findFirst).mockResolvedValue({
      id: 'd-1',
      opsHash: 'opA',
      userId: 'u-1',
      bakerPkh: 'tz1galata',
      amount: 100n,
      status: 'PENDING',
      blockLevel: null,
      blockTime: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.delegation.update).mockResolvedValue({} as never);

    const tzkt = {
      get: vi
        .fn()
        // head
        .mockResolvedValueOnce([{ level: 100 }])
        // delegation page
        .mockResolvedValueOnce([
          {
            id: 1,
            level: 100,
            timestamp: '2026-06-01T00:00:00Z',
            hash: 'opA',
            sender: { address: 'tz1user' },
            delegate: { address: 'tz1galata' },
            amount: '100',
            status: 'applied',
          },
        ]),
    };

    const r = await new DelegationSync(tzkt, 100).run();
    expect(r.confirmed).toBe(1);
    expect(r.failed).toBe(0);
    expect(prisma.delegation.update).toHaveBeenCalledWith({
      where: { id: 'd-1' },
      data: expect.objectContaining({ status: 'CONFIRMED', blockLevel: 100 }),
    });
  });

  it('marks a pending delegation FAILED when op status is failed', async () => {
    vi.mocked(prisma.delegation.findFirst).mockResolvedValue({
      id: 'd-2',
      opsHash: 'opB',
      userId: 'u-1',
      bakerPkh: 'tz1galata',
      amount: 100n,
      status: 'PENDING',
      blockLevel: null,
      blockTime: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const tzkt = {
      get: vi
        .fn()
        .mockResolvedValueOnce([{ level: 200 }])
        .mockResolvedValueOnce([
          {
            id: 2,
            level: 200,
            timestamp: '2026-06-01T00:00:00Z',
            hash: 'opB',
            sender: { address: 'tz1user' },
            delegate: { address: 'tz1galata' },
            amount: '100',
            status: 'failed',
          },
        ]),
    };

    const r = await new DelegationSync(tzkt, 100).run();
    expect(r.failed).toBe(1);
    expect(prisma.delegation.update).toHaveBeenCalledWith({
      where: { id: 'd-2' },
      data: expect.objectContaining({ status: 'FAILED', errorMessage: 'tzkt status=failed' }),
    });
  });
});
