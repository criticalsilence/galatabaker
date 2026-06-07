import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createTezosClient, resolveConfig } from './client.js';
import { USHUAIA_TESTNET } from './network.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTezosClient', () => {
  it('returns a TezosToolkit instance', () => {
    expect(createTezosClient()).toBeDefined();
  });

  it('defaults to Ushuaia testnet RPC', () => {
    expect(createTezosClient().rpc.getRpcUrl()).toBe(USHUAIA_TESTNET.rpcUrl);
  });

  it('accepts network by key', () => {
    expect(createTezosClient({ network: 'ushuaia' }).rpc.getRpcUrl()).toBe(USHUAIA_TESTNET.rpcUrl);
  });

  it('accepts a custom config object', () => {
    const custom = { ...USHUAIA_TESTNET, rpcUrl: 'https://my-rpc.example.com' };
    expect(createTezosClient({ network: custom }).rpc.getRpcUrl()).toBe(
      'https://my-rpc.example.com',
    );
  });

  it('overrideRpcUrl wins over network.rpcUrl', () => {
    const client = createTezosClient({
      network: 'ushuaia',
      overrideRpcUrl: 'https://override.example.com',
    });
    expect(client.rpc.getRpcUrl()).toBe('https://override.example.com');
  });
});

describe('resolveConfig', () => {
  it('returns Ushuaia when called with no args', () => {
    expect(resolveConfig()).toBe(USHUAIA_TESTNET);
  });

  it('throws on unknown network key', () => {
    expect(() => resolveConfig('mainnet-archive' as never)).toThrow(/Unknown network/);
  });

  it('returns the same object reference when given a config', () => {
    const custom = { ...USHUAIA_TESTNET, name: 'custom' };
    expect(resolveConfig(custom)).toBe(custom);
  });
});
