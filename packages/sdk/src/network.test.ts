import { NetworkType } from '@airgap/beacon-types';
import { describe, it, expect } from 'vitest';

import { USHUAIA_TESTNET, NETWORKS, type NetworkKey } from './network.js';

describe('network config', () => {
  it('Ushuaia is registered as a CUSTOM Beacon network', () => {
    expect(USHUAIA_TESTNET.network).toBe(NetworkType.CUSTOM);
  });

  it('Ushuaia has a teztnets.com RPC URL', () => {
    expect(USHUAIA_TESTNET.rpcUrl).toMatch(/^https:\/\/.*teztnets\.com$/);
  });

  it('Ushuaia has the expected chain id (NetXdQprcVkpaWU)', () => {
    expect(USHUAIA_TESTNET.chainId).toBe('NetXdQprcVkpaWU');
  });

  it('Ushuaia has a tzktUrl on the same teztnets host', () => {
    expect(USHUAIA_TESTNET.tzktUrl).toContain('teztnets.com');
  });

  it('Ushuaia exposes a faucet URL for test tez', () => {
    expect(USHUAIA_TESTNET.faucetUrl).toMatch(/^https:\/\/faucet\./);
  });

  it('NETWORKS registry contains ushuaia', () => {
    expect(NETWORKS.ushuaia).toBe(USHUAIA_TESTNET);
  });

  it('NetworkKey is a union of registered network names', () => {
    const k: NetworkKey = 'ushuaia';
    expect(k).toBe('ushuaia');
  });
});
