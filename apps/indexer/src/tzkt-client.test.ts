import { describe, expect, it, vi } from 'vitest';

import { TzktHttpClient } from './tzkt-client';

describe('TzktHttpClient', () => {
  it('hits the right URL with string query', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ level: 100 }],
    });
    vi.stubGlobal('fetch', fetchMock);

    const c = new TzktHttpClient('https://api.example.test');
    const r = await c.get<Array<{ level: number }>>('/v1/head', { select: 'level' });

    expect(r).toEqual([{ level: 100 }]);
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain('https://api.example.test/v1/head');
    expect(String(calledUrl)).toContain('select=level');
  });

  it('retries on 500 then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'oops' })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    const c = new TzktHttpClient('https://api.example.test');
    const r = await c.get<unknown[]>('/v1/delegates');
    expect(r).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws after MAX_RETRIES on persistent 5xx', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 503, text: async () => 'down' });
    vi.stubGlobal('fetch', fetchMock);

    const c = new TzktHttpClient('https://api.example.test', { backoffMs: [1, 1, 1] });
    await expect(c.get('/v1/head')).rejects.toThrow(/TzKT 503/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 2000);
});
