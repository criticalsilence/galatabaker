// Full SIWW flow E2E test (CLI)
// 1. Generate ed25519 keypair
// 2. Get challenge
// 3. Sign message (TZIP-32 format with blake2b-256)
// 4. Verify (get JWT)
// 5. Call protected endpoint with JWT
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { blake2b } from '@noble/hashes/blake2.js';
import { utf8ToBytes, concatBytes } from '@noble/hashes/utils.js';
import { b58Encode, getPkhfromPk, PrefixV2 } from '@taquito/utils';

const base = 'http://localhost:3001/api';

// 1. Generate ed25519 keypair
const priv = sha256(utf8ToBytes('galatabaker-e2e-test'));
const pub = ed25519.getPublicKey(priv);
// Tezos public keys MUST be encoded with the edpk prefix (PrefixV2.Ed25519PublicKey).
// bs58check.encode would give the wrong (Bitcoin-style) prefix.
const pubB58 = b58Encode(pub, PrefixV2.Ed25519PublicKey);

// 2. Derive tz1 address via Taquito (canonical implementation)
const walletPkh = getPkhfromPk(pubB58);
console.log('Wallet:', walletPkh);

// 3. Get challenge
const ch = await fetch(`${base}/auth/challenge`).then((r) => r.json());
console.log('Challenge nonce:', ch.nonce.slice(0, 20) + '...');

// 4. Build canonical message (must match server)
const ts = Math.floor(Date.now() / 1000);
const message = [
  'GalataBaker SIWW',
  `domain: ${ch.message.match(/domain: (.*)/)[1]}`,
  `nonce: ${ch.nonce}`,
  `timestamp: ${ts}`,
].join('\n');
console.log('Message:', message);

// 5. Sign message (TZIP-32 format)
//    Payload: [0x01]["Tezos Signed Message:\n"][4-byte msgLen][msg][pubkey]
//    Tezos ed25519: blake2b-256(payload) then ed25519.sign
const watermark = concatBytes(new Uint8Array([0x01]), utf8ToBytes('Tezos Signed Message:\n'));
const msgBytes = utf8ToBytes(message);
const msgLen = new Uint8Array(4);
new DataView(msgLen.buffer).setUint32(0, msgBytes.length, false);
const signedPayload = concatBytes(watermark, msgLen, msgBytes, pub);
const payloadHash = blake2b(signedPayload, { dkLen: 32 });
const sig = ed25519.sign(payloadHash, priv);
// Tezos signatures MUST be encoded with the edsig prefix (PrefixV2.Ed25519Signature).
const sigB58 = b58Encode(sig, PrefixV2.Ed25519Signature);
console.log('Sig prefix OK:', sigB58.startsWith(PrefixV2.Ed25519Signature));

// 6. Verify
const verifyRes = await fetch(`${base}/auth/verify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletPkh,
    publicKey: pubB58,
    signature: sigB58,
    nonce: ch.nonce,
    timestamp: ts,
  }),
});
const verifyData = await verifyRes.json();
console.log('Verify status:', verifyRes.status, JSON.stringify(verifyData).slice(0, 200));

if (verifyRes.status !== 201 && verifyRes.status !== 200) process.exit(1);

// 7. Use JWT on protected endpoint
const me = await fetch(`${base}/users/${walletPkh}`, {
  headers: { Authorization: `Bearer ${verifyData.accessToken}` },
});
const meData = await me.json();
console.log('Me status:', me.status, JSON.stringify(meData).slice(0, 200));

if (me.status === 200) {
  console.log('\nFULL SIWW FLOW PASS ✓');
} else {
  console.log('\nFAILED');
  process.exit(1);
}
