import { describe, it, expect, vi, beforeEach } from 'vitest';

import { USHUAIA_TESTNET } from './network.js';
import { TzktClient, createTzktClient } from './tzkt.js';

const baseUrl = USHUAIA_TESTNET.tzktUrl;

function makeFetchOk(payload: unknown): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(payload),
    json: async () => payload,
  })) as unknown as typeof fetch;
}

function makeFetchFail(status = 404, body = 'not found'): typeof fetch {
  return vi.fn(async () => ({
    ok: false,
    status,
    statusText: 'X',
    text: async () => body,
    json: async () => {
      throw new Error('not json');
    },
  })) as unknown as typeof fetch;
}

beforeEach((): void => {
  vi.clearAllMocks();
});

describe('createTzktClient', () => {
  it('returns a TzktClient instance', () => {
    expect(createTzktClient()).toBeInstanceOf(TzktClient);
  });

  it('derives baseUrl from overrideRpcUrl origin', () => {
    // baseUrl private; davranışı getHead'in doğru URL'i çağırmasından kontrol ediyoruz
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '{}',
      json: async () => ({ level: 1, timestamp: 'x', proposer: null }),
    })) as unknown as typeof fetch;
    const client = createTzktClient({
      overrideRpcUrl: 'https://my-indexer.example.com/rpc/v1',
      fetchImpl,
    });
    client.getHead();
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://my-indexer.example.com/v1/head',
      expect.objectContaining({}),
    );
  });

  it('falls back to config.tzktUrl when overrideRpcUrl is malformed', () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '{}',
      json: async () => ({ level: 1, timestamp: 'x', proposer: null }),
    })) as unknown as typeof fetch;
    const client = createTzktClient({ overrideRpcUrl: 'not-a-url', fetchImpl });
    client.getHead();
    expect(fetchImpl).toHaveBeenCalledWith(`${baseUrl}/v1/head`, expect.objectContaining({}));
  });
});

describe('TzktClient.getHead', () => {
  it('returns parsed JSON', async () => {
    const fetchImpl = makeFetchOk({ level: 42, timestamp: '2026-06-07T12:00:00Z', proposer: null });
    const c = new TzktClient(baseUrl, { fetchImpl });
    const head = await c.getHead();
    expect(head.level).toBe(42);
    expect(fetchImpl).toHaveBeenCalledWith(
      `${baseUrl}/v1/head`,
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'application/json' }),
      }),
    );
  });

  it('throws on non-2xx with truncated body', async () => {
    const fetchImpl = makeFetchFail(500, 'internal error');
    const c = new TzktClient(baseUrl, { fetchImpl });
    await expect(c.getHead()).rejects.toThrow(/TzKT 500/);
  });
});

describe('TzktClient.getAccount', () => {
  it('returns first row or null', async () => {
    const c1 = new TzktClient(baseUrl, {
      fetchImpl: makeFetchOk([
        { type: 'user', address: 'tz1abc', balance: '0', delegatedBalance: '0' },
      ]),
    });
    const acc = await c1.getAccount('tz1abc');
    expect(acc?.address).toBe('tz1abc');

    const c2 = new TzktClient(baseUrl, { fetchImpl: makeFetchOk([]) });
    expect(await c2.getAccount('tz1nobody')).toBeNull();
  });
});

describe('TzktClient.getDelegations', () => {
  it('builds query with delegator and sort.desc=id', async () => {
    const fetchImpl = makeFetchOk([]);
    const c = new TzktClient(baseUrl, { fetchImpl });
    await c.getDelegations('tz1xyz', 50);
    expect(fetchImpl).toHaveBeenCalledWith(
      `${baseUrl}/v1/operations/delegations?delegator=tz1xyz&limit=50&sort.desc=id`,
      expect.objectContaining({}),
    );
  });

  it('clamps limit into [1, 1000]', async () => {
    const fetchImpl = makeFetchOk([]);
    const c = new TzktClient(baseUrl, { fetchImpl });
    await c.getDelegations('tz1a', 9999);
    expect(fetchImpl).toHaveBeenLastCalledWith(
      expect.stringContaining('limit=1000'),
      expect.objectContaining({}),
    );
    await c.getDelegations('tz1a', 0);
    expect(fetchImpl).toHaveBeenLastCalledWith(
      expect.stringContaining('limit=1'),
      expect.objectContaining({}),
    );
  });
});
