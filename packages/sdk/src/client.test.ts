import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createTezosClient, resolveConfig } from './client.js';
import { BAKINGNET_TESTNET, SHADOWNET_TESTNET } from './network.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTezosClient', () => {
  it('returns a TezosToolkit instance', () => {
    expect(createTezosClient()).toBeDefined();
  });

  it('defaults to Bakingnet testnet RPC', () => {
    expect(createTezosClient().rpc.getRpcUrl()).toBe(BAKINGNET_TESTNET.rpcUrl);
  });

  it('accepts bakingnet by key', () => {
    expect(createTezosClient({ network: 'bakingnet' }).rpc.getRpcUrl()).toBe(
      BAKINGNET_TESTNET.rpcUrl,
    );
  });

  it('accepts shadownet by key', () => {
    expect(createTezosClient({ network: 'shadownet' }).rpc.getRpcUrl()).toBe(
      SHADOWNET_TESTNET.rpcUrl,
    );
  });

  it('accepts a custom config object', () => {
    const custom = { ...BAKINGNET_TESTNET, rpcUrl: 'https://my-rpc.example.com' };
    expect(createTezosClient({ network: custom }).rpc.getRpcUrl()).toBe(
      'https://my-rpc.example.com',
    );
  });

  it('overrideRpcUrl wins over network.rpcUrl', () => {
    const client = createTezosClient({
      network: 'bakingnet',
      overrideRpcUrl: 'https://override.example.com',
    });
    expect(client.rpc.getRpcUrl()).toBe('https://override.example.com');
  });
});

describe('resolveConfig', () => {
  it('returns Bakingnet when called with no args', () => {
    expect(resolveConfig()).toBe(BAKINGNET_TESTNET);
  });

  it('returns Bakingnet when given "bakingnet"', () => {
    expect(resolveConfig('bakingnet')).toBe(BAKINGNET_TESTNET);
  });

  it('returns Shadownet when given "shadownet"', () => {
    expect(resolveConfig('shadownet')).toBe(SHADOWNET_TESTNET);
  });

  it('throws on unknown network key', () => {
    expect(() => resolveConfig('mainnet-archive' as never)).toThrow(/Unknown network/);
  });

  it('returns the same object reference when given a config', () => {
    const custom = { ...BAKINGNET_TESTNET, name: 'custom' };
    expect(resolveConfig(custom)).toBe(custom);
  });
});
