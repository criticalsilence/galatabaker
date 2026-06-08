import { describe, it, expect } from 'vitest';

import { mutezToTez, truncateAddress } from './format.js';

describe('mutezToTez', () => {
  it('converts 1.5 tez', () => {
    expect(mutezToTez('1500000')).toBe('1.5');
  });

  it('converts exact integer values', () => {
    expect(mutezToTez('1000000')).toBe('1');
    expect(mutezToTez('0')).toBe('0');
  });

  it('converts fractional values', () => {
    expect(mutezToTez('100000')).toBe('0.1');
    expect(mutezToTez('1000010')).toBe('1.00001');
  });

  it('trims trailing zeros', () => {
    expect(mutezToTez('1100000')).toBe('1.1');
  });

  it('handles large amounts', () => {
    // 123456.789 tez = 123456789000 mutez
    expect(mutezToTez('123456789000')).toBe('123456.789');
    // 1M tez = 1_000_000_000_000 mutez
    expect(mutezToTez('1000000000000')).toBe('1000000');
  });

  it('accepts number and bigint', () => {
    expect(mutezToTez(1500000)).toBe('1.5');
    expect(mutezToTez(1500000n)).toBe('1.5');
  });
});

describe('truncateAddress', () => {
  it('returns short addresses as-is', () => {
    expect(truncateAddress('tz1abc')).toBe('tz1abc');
  });

  it('truncates long addresses with default head/tail', () => {
    expect(truncateAddress('tz1longaddressxxxxxxx1234')).toBe('tz1lon…1234');
  });

  it('honors custom head/tail', () => {
    expect(truncateAddress('tz1longaddressxxxxxxx1234', 4, 4)).toBe('tz1l…1234');
  });
});
