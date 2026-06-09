// Comprehensive SIWW + user flow E2E test
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { blake2b } from '@noble/hashes/blake2.js';
import { utf8ToBytes, concatBytes } from '@noble/hashes/utils.js';
import { b58Encode, getPkhfromPk, PrefixV2 } from '@taquito/utils';

const base = 'http://localhost:3001/api';

function log(stage, ok, detail) {
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} [${stage}] ${detail}`);
  if (!ok) process.exit(1);
}

// 1. Generate ed25519 keypair (deterministic for repeatability)
const priv = sha256(utf8ToBytes('comprehensive-e2e-' + Date.now().toString().slice(-6)));
const pub = ed25519.getPublicKey(priv);
const pubB58 = b58Encode(pub, PrefixV2.Ed25519PublicKey);
const walletPkh = getPkhfromPk(pubB58);
log('SETUP', true, `wallet=${walletPkh} pub=${pubB58.slice(0, 12)}…`);

// 2. Get challenge
const chRes = await fetch(`${base}/auth/challenge`);
const ch = await chRes.json();
log('CHALLENGE', chRes.ok, `nonce=${ch.nonce.slice(0, 8)}… expiresAt=${ch.expiresAt}`);

// 3. Sign canonical message
const message = ch.message;
const msgBytes = utf8ToBytes(message);
const msgLen = new Uint8Array(4);
new DataView(msgLen.buffer).setUint32(0, msgBytes.length, false);
const watermark = concatBytes(new Uint8Array([0x01]), utf8ToBytes('Tezos Signed Message:\n'));
const signedPayload = concatBytes(watermark, msgLen, msgBytes, pub);
const payloadHash = blake2b(signedPayload, { dkLen: 32 });
const sig = ed25519.sign(payloadHash, priv);
const sigB58 = b58Encode(sig, PrefixV2.Ed25519Signature);
log('SIGN', true, `sig prefix=${sigB58.slice(0, 5)} msgLen=${msgBytes.length}`);

// 4. Verify (extract timestamp from message)
const tsMatch = message.match(/timestamp: (\d+)/);
const ts = parseInt(tsMatch[1]);
const verifyRes = await fetch(`${base}/auth/verify`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    walletPkh,
    publicKey: pubB58,
    signature: sigB58,
    nonce: ch.nonce,
    timestamp: ts,
  }),
});
const verify = await verifyRes.json();
log(
  'VERIFY',
  verifyRes.ok,
  `accessToken=${verify.accessToken?.slice(0, 20)}… walletPkh=${verify.walletPkh}`,
);
const token = verify.accessToken;

// 5. Hit protected /users/:walletPkh (uses JWT for ownership)
const meRes = await fetch(`${base}/users/${walletPkh}`, {
  headers: { authorization: `Bearer ${token}` },
});
const me = await meRes.json();
log('ME', meRes.ok, `id=${me.id?.slice(0, 12)}… role=${me.role} walletPkh=${me.walletPkh}`);

// 6. Update email (use unique address to avoid conflict with prior runs)
const uniqueEmail = `e2e-${Date.now()}@example.com`;
const updateEmailRes = await fetch(`${base}/users/${walletPkh}/email`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ email: uniqueEmail }),
});
const ue = await updateEmailRes.json();
log(
  'UPDATE_EMAIL',
  updateEmailRes.ok && ue.sent === true,
  `status=${updateEmailRes.status} sent=${ue.sent} maskedEmail=${ue.maskedEmail}`,
);

// 7. Verify email token (using a fake token to see the failure path)
const fakeTokenRes = await fetch(
  `${base}/users/verify-email?token=fake-token&walletPkh=${walletPkh}`,
);
log(
  'VERIFY_EMAIL_FAKE',
  fakeTokenRes.status === 400 || fakeTokenRes.status === 404,
  `expected 400/404 got ${fakeTokenRes.status}`,
);

// 8. Hit bakers endpoint (public, no auth needed)
const bakersRes = await fetch(`${base}/bakers`);
log('BAKERS_PUBLIC', bakersRes.ok, `status=${bakersRes.status}`);

// 9. Public user lookup is intentional (baker profile pages, PII masked via toPublic)
const mePublic = await fetch(`${base}/users/${walletPkh}`);
const mePubBody = await mePublic.json();
const hasRawEmail = typeof mePubBody.email === 'string' && mePubBody.email.includes('@');
const hasRawTg =
  typeof mePubBody.telegramChatId === 'string' && mePubBody.telegramChatId.length > 0;
log(
  'ME_PUBLIC',
  mePublic.ok && !hasRawEmail && !hasRawTg,
  `emailMasked=${mePubBody.emailMasked} rawEmail=${hasRawEmail} rawTg=${hasRawTg}`,
);

// 10. Ownership guard: try to update SOMEONE ELSE's email with MY token
const otherPkh = 'tz1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // fake
const otherEmailRes = await fetch(`${base}/users/${otherPkh}/email`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ email: 'attacker@example.com' }),
});
log('OWNERSHIP_GUARD', otherEmailRes.status === 401, `expected 401 got ${otherEmailRes.status}`);

// 10. Wrong timestamp (replay)
const ch2 = await (await fetch(`${base}/auth/challenge`)).json();
const oldTs = Math.floor(Date.now() / 1000) - 7200;
const oldMsg = ch2.message.replace(/timestamp: \d+/, `timestamp: ${oldTs}`);
const oldMsgBytes = utf8ToBytes(oldMsg);
const oldMsgLen = new Uint8Array(4);
new DataView(oldMsgLen.buffer).setUint32(0, oldMsgBytes.length, false);
const oldSig = ed25519.sign(
  blake2b(concatBytes(watermark, oldMsgLen, oldMsgBytes, pub), { dkLen: 32 }),
  priv,
);
const replayRes = await fetch(`${base}/auth/verify`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    walletPkh,
    publicKey: pubB58,
    signature: b58Encode(oldSig, PrefixV2.Ed25519Signature),
    nonce: ch2.nonce,
    timestamp: oldTs,
  }),
});
log('REPLAY_REJECTED', replayRes.status === 401, `expected 401 got ${replayRes.status}`);

console.log('\n🎉 COMPREHENSIVE E2E PASS — all 10 stages green');
