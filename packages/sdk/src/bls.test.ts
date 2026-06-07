import { describe, it, expect } from 'vitest';

import { generateBlsKeyPair, signBls, verifyBls } from './bls.js';

describe('BLS helper', () => {
  it('generates a keypair with distinct public/secret keys', async () => {
    const kp = await generateBlsKeyPair();
    expect(kp.publicKey).toBeTypeOf('string');
    expect(kp.publicKey.length).toBeGreaterThan(0);
    expect(kp.secretKey).toBeTypeOf('string');
    expect(kp.secretKey).not.toBe(kp.publicKey);
  });

  it('signs and verifies a message round-trip', async () => {
    const kp = await generateBlsKeyPair();
    const msg = new TextEncoder().encode('hello world');
    const sig = await signBls(kp.secretKey, msg);
    expect(sig).toBeTypeOf('string');
    expect(sig.length).toBeGreaterThan(0);
    expect(await verifyBls(kp.publicKey, msg, sig)).toBe(true);
  });

  it('fails verification for a different message', async () => {
    const kp = await generateBlsKeyPair();
    const msg1 = new TextEncoder().encode('hello');
    const msg2 = new TextEncoder().encode('world');
    const sig = await signBls(kp.secretKey, msg1);
    expect(await verifyBls(kp.publicKey, msg2, sig)).toBe(false);
  });

  it('fails verification under a different public key', async () => {
    const kp1 = await generateBlsKeyPair();
    const kp2 = await generateBlsKeyPair();
    const msg = new TextEncoder().encode('signed-by-kp1');
    const sig = await signBls(kp1.secretKey, msg);
    expect(await verifyBls(kp2.publicKey, msg, sig)).toBe(false);
  });

  it('returns false for malformed hex inputs (does not throw)', async () => {
    const msg = new TextEncoder().encode('x');
    expect(await verifyBls('not-hex', msg, 'also-not-hex')).toBe(false);
  });
});
