import { NetworkType } from '@airgap/beacon-types';
import { describe, it, expect } from 'vitest';

import { BAKINGNET_TESTNET, SHADOWNET_TESTNET, NETWORKS, type NetworkKey } from './network.js';

describe('bakingnet config', () => {
  it('is registered as a CUSTOM Beacon network', () => {
    expect(BAKINGNET_TESTNET.network).toBe(NetworkType.CUSTOM);
  });

  it('has a teztnets.com RPC URL', () => {
    expect(BAKINGNET_TESTNET.rpcUrl).toMatch(/^https:\/\/.*teztnets\.com$/);
  });

  it('has the expected chain id (NetXvNVUNbWHxGt)', () => {
    expect(BAKINGNET_TESTNET.chainId).toBe('NetXvNVUNbWHxGt');
  });

  it('has a tzktUrl on the tzkt.io host', () => {
    expect(BAKINGNET_TESTNET.tzktUrl).toMatch(/^https:\/\/api\..*tzkt\.io/);
  });

  it('exposes a faucet URL for test tez', () => {
    expect(BAKINGNET_TESTNET.faucetUrl).toMatch(/^https:\/\/faucet\./);
  });

  it('NETWORKS registry contains bakingnet', () => {
    expect(NETWORKS.bakingnet).toBe(BAKINGNET_TESTNET);
  });
});

describe('shadownet config', () => {
  it('is registered as a CUSTOM Beacon network', () => {
    expect(SHADOWNET_TESTNET.network).toBe(NetworkType.CUSTOM);
  });

  it('has the expected chain id (NetXsqzbfFenSTS)', () => {
    expect(SHADOWNET_TESTNET.chainId).toBe('NetXsqzbfFenSTS');
  });

  it('NETWORKS registry contains shadownet', () => {
    expect(NETWORKS.shadownet).toBe(SHADOWNET_TESTNET);
  });
});

describe('NetworkKey type', () => {
  it('is a union of registered network names', () => {
    const bakingnetKey: NetworkKey = 'bakingnet';
    const shadownetKey: NetworkKey = 'shadownet';
    expect(bakingnetKey).toBe('bakingnet');
    expect(shadownetKey).toBe('shadownet');
  });
});
