/**
 * GalataBaker API — ResendProvider unit tests.
 *
 * Real Resend API çağrısı YOK — global fetch mock'lanır (vi.stubGlobal).
 *
 * Kritik test'ler:
 *   - name: 'resend'
 *   - send(): fetch doğru URL + method + headers + body ile çağrılır
 *   - send(): 200 + {id} → success döner
 *   - send(): 200 + {} → fallback id üretir
 *   - send(): 4xx/5xx → status='failed' + error message
 *   - send(): network throw → status='failed' + error message
 *   - send(): to array olarak gider (Resend API spec)
 *   - send(): text opsiyonel
 *   - send(): API key loglanmaz (hata mesajlarında bile)
 *   - ping(): 2xx → reachable=true
 *   - ping(): 5xx → reachable=false
 *   - ping(): 401/403 → reachable=true (auth problemi değil network)
 *   - ping(): throw → reachable=false
 */

import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ResendProvider } from './resend.provider.js';

const testConfig = {
  apiKey: 're_test_abcdefghijklmnop',
  apiUrl: 'https://api.resend.com/emails',
  fromAddress: 'noreply@galatabaker.io',
  fromName: 'GalataBaker',
};

describe('ResendProvider', () => {
  let provider: ResendProvider;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    provider = new ResendProvider(testConfig);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('name', () => {
    it('is resend', () => {
      expect(provider.name).toBe('resend');
    });
  });

  describe('send()', () => {
    const opts = {
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>hi</p>',
    };

    it('calls fetch with correct URL, method, headers, body', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'res-1' }),
      });

      await provider.send(opts);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://api.resend.com/emails');
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.headers.Authorization).toBe('Bearer re_test_abcdefghijklmnop');
      const body = JSON.parse(init.body);
      expect(body.from).toBe('"GalataBaker" <noreply@galatabaker.io>');
      expect(body.to).toEqual(['user@example.com']);
      expect(body.subject).toBe('Hello');
      expect(body.html).toBe('<p>hi</p>');
    });

    it('returns sent result with provider id on 200', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'res-abc' }),
      });

      const result = await provider.send(opts);

      expect(result).toEqual({
        id: 'res-abc',
        status: 'sent',
        provider: 'resend',
      });
    });

    it('falls back to generated id when response has no id', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      const result = await provider.send(opts);

      expect(result.status).toBe('sent');
      expect(result.id).toMatch(/^resend-/);
    });

    it('returns failed result on 4xx', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: async () => 'validation error',
      });

      const result = await provider.send(opts);

      expect(result.status).toBe('failed');
      expect(result.provider).toBe('resend');
      expect(result.error).toContain('422');
      expect(result.error).toContain('validation error');
    });

    it('returns failed result on 5xx', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'internal error',
      });

      const result = await provider.send(opts);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('500');
    });

    it('returns failed result when fetch throws (network)', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));

      const result = await provider.send(opts);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('ECONNRESET');
    });

    it('includes text field in body when provided', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'r' }),
      });

      await provider.send({ ...opts, text: 'plain' });

      const [, init] = fetchMock.mock.calls[0]!;
      const body = JSON.parse(init.body);
      expect(body.text).toBe('plain');
    });

    it('does NOT include text field in body when not provided', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'r' }),
      });

      await provider.send(opts);

      const [, init] = fetchMock.mock.calls[0]!;
      const body = JSON.parse(init.body);
      expect(body).not.toHaveProperty('text');
    });

    it('never leaks API key in failed result error message', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const result = await provider.send(opts);

      // API key hiçbir response alanında olmamalı
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('re_test_abc');
    });
  });

  describe('ping()', () => {
    it('returns reachable=true on 2xx', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

      const result = await provider.ping();

      expect(result.reachable).toBe(true);
      expect(result.provider).toBe('resend');
      expect(typeof result.latencyMs).toBe('number');
    });

    it('returns reachable=true on 401 (auth problem, not network)', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

      const result = await provider.ping();

      expect(result.reachable).toBe(true);
    });

    it('returns reachable=false on 5xx', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });

      const result = await provider.ping();

      expect(result.reachable).toBe(false);
      expect(result.error).toContain('503');
    });

    it('returns reachable=false when fetch throws', async () => {
      fetchMock.mockRejectedValueOnce(new Error('DNS resolution failed'));

      const result = await provider.ping();

      expect(result.reachable).toBe(false);
      expect(result.error).toBe('DNS resolution failed');
    });
  });
});
