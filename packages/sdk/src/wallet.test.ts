import { BeaconWallet } from '@taquito/beacon-wallet';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWallet } from './wallet.js';

vi.mock('@taquito/beacon-wallet', () => {
  return {
    BeaconWallet: vi.fn().mockImplementation(() => ({
      client: {
        subscribeToEvent: vi.fn(),
        getActiveAccount: vi.fn().mockResolvedValue(null),
        removeAllAccounts: vi.fn().mockResolvedValue(undefined),
        removeAllPeers: vi.fn().mockResolvedValue(undefined),
      },
      requestPermissions: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createWallet', () => {
  it('returns an object with the expected methods', () => {
    const w = createWallet();
    expect(w.getAddress).toBeTypeOf('function');
    expect(w.requestPermissions).toBeTypeOf('function');
    expect(w.disconnect).toBeTypeOf('function');
    expect(w.getActiveAccount).toBeTypeOf('function');
    expect(w.getBeaconWallet).toBeTypeOf('function');
  });

  it('instantiates BeaconWallet under the hood', () => {
    createWallet();
    expect(BeaconWallet).toHaveBeenCalled();
  });

  it('getActiveAccount returns null when no account is connected', async () => {
    const w = createWallet();
    expect(await w.getActiveAccount()).toBeNull();
  });

  it('getAddress throws when no account is connected', async () => {
    const w = createWallet();
    await expect(w.getAddress()).rejects.toThrow(/No active Beacon account/);
  });
});
