import { describe, it, expect } from 'vitest';

import { extractErrorMessage } from './error.js';

describe('extractErrorMessage', () => {
  it('returns trimmed string for string input', () => {
    expect(extractErrorMessage('  hello  ')).toBe('hello');
    expect(extractErrorMessage('')).toBe('Unknown error');
  });

  it('handles null and undefined', () => {
    expect(extractErrorMessage(null)).toBe('Unknown error');
    expect(extractErrorMessage(undefined)).toBe('Unknown error');
  });

  it('extracts description from BeaconError-style object', () => {
    const err = Object.assign(new Error('WalletNotFound'), {
      title: 'WalletNotFound',
      description: 'No Tezos wallet extension found',
    });
    expect(extractErrorMessage(err)).toBe('No Tezos wallet extension found');
  });

  it('falls back to title when description is missing', () => {
    const err = Object.assign(new Error('WalletNotFound'), {
      title: 'WalletNotFound',
    });
    expect(extractErrorMessage(err)).toBe('WalletNotFound');
  });

  it('falls back to message when Beacon fields are missing', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('rejects literal "[object Object]" message and falls back to name', () => {
    // Bir Error instance'ı ürettik; message alanı yanlışlıkla literal
    // "[object Object]" olduysa, kullanıcıya onu göstermek yerine name'e
    // düşmek daha temiz. Bu kasıtlı: gerçek mesajı kaybediyoruz ama
    // "object object" gibi anlamsız bir string göstermiyoruz.
    const err = new Error('[object Object]');
    expect(extractErrorMessage(err)).toBe('Error');
  });

  it('prefers description over literal "[object Object]" message', () => {
    const err = Object.assign(new Error('[object Object]'), {
      description: 'Wallet connection was cancelled by user',
    });
    expect(extractErrorMessage(err)).toBe('Wallet connection was cancelled by user');
  });

  it('falls back to Error name when message is useless', () => {
    const err = new TypeError();
    err.message = '';
    expect(extractErrorMessage(err)).toBe('TypeError');
  });

  it('handles plain object with description', () => {
    expect(extractErrorMessage({ description: 'Temple: locked' })).toBe('Temple: locked');
  });

  it('handles plain object with message', () => {
    expect(extractErrorMessage({ message: 'Connection lost' })).toBe('Connection lost');
  });

  it('handles plain object with title', () => {
    expect(extractErrorMessage({ title: 'NetworkError' })).toBe('NetworkError');
  });

  it('handles plain object with error field', () => {
    expect(extractErrorMessage({ error: 'Pairing failed' })).toBe('Pairing failed');
  });

  it('returns "Unknown error (no message)" for empty object', () => {
    expect(extractErrorMessage({})).toBe('Unknown error (no message)');
  });

  it('returns JSON for object with unknown fields', () => {
    const result = extractErrorMessage({ code: 42, foo: 'bar' });
    expect(result).toContain('"code":42');
    expect(result).toContain('"foo":"bar"');
  });

  it('handles object with "[object Object]" message gracefully', () => {
    // Plain object with message === '[object Object]' should not return that
    const result = extractErrorMessage({ message: '[object Object]' });
    // No description/title/error → falls through to JSON
    expect(result).not.toBe('[object Object]');
    expect(result).toContain('[object Object]');
  });

  it('handles numbers and booleans', () => {
    expect(extractErrorMessage(42)).toBe('42');
    expect(extractErrorMessage(true)).toBe('true');
  });
});
