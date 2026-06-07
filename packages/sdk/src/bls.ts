import createModule, { type ModuleInstance } from 'bls-signatures';

/**
 * BLS12-381 yardımcıları (tz4 baker adresleri için).
 *
 * bls-signatures 2.x async WASM yükler; bu yüzden tüm fonksiyonlar async.
 * Tezos'un BLS scheme'i `PopSchemeMPL`'dir (BLS12-381 + DST).
 *
 * Güvenlik: Üretim (mainnet) baker anahtarları ASLA bu modül ile üretilmez
 * ve SDK'da SAKLANMAZ. Remote signer (SIGNATORY, TZ4REMOTE) kullanılır; bu
 * modül yalnızca public key ile verify eder ve testnet/fixture üretir.
 */

let blsInstance: ModuleInstance | null = null;
let initPromise: Promise<ModuleInstance> | null = null;

async function getBls(): Promise<ModuleInstance> {
  if (blsInstance) return blsInstance;
  if (!initPromise) {
    initPromise = createModule().then((m) => {
      blsInstance = m;
      return m;
    });
  }
  return initPromise;
}

export interface BlsKeyPair {
  /** BLS12-381 G1 public key — hex. */
  publicKey: string;
  /** BLS12-381 secret key — hex. SADECE testnet/fixture. Production remote signer. */
  secretKey: string;
}

function bytesToHex(bytes: Uint8Array): string {
  // Buffer her Node.js sürümünde mevcut, browser bundle'ında da polyfill var.
  return Buffer.from(bytes).toString('hex');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('hex string must have even length');
  return new Uint8Array(Buffer.from(clean, 'hex'));
}

/**
 * Yeni bir BLS12-381 keypair üretir.
 *
 * ⚠️ Yalnızca testnet/fixture üretimi. Mainnet anahtarları için
 *    SIGNATORY veya benzeri remote signer kullanılmalı.
 */
export async function generateBlsKeyPair(): Promise<BlsKeyPair> {
  const bls = await getBls();
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  const sk = bls.PopSchemeMPL.key_gen(seed);
  const pk = bls.PopSchemeMPL.sk_to_g1(sk);
  return {
    publicKey: bytesToHex(pk.serialize()),
    secretKey: bytesToHex(sk.serialize()),
  };
}

/**
 * Mesajı BLS12-381 (PopSchemeMPL) secret key ile imzalar.
 *
 * @param secretKeyHex Serialize edilmiş secret key (hex)
 * @param message İmzalanacak mesaj
 */
export async function signBls(secretKeyHex: string, message: Uint8Array): Promise<string> {
  const bls = await getBls();
  const sk = bls.PrivateKey.from_bytes(hexToBytes(secretKeyHex), false);
  const sig = bls.PopSchemeMPL.sign(sk, message);
  return bytesToHex(sig.serialize());
}

/**
 * BLS12-381 imzasını doğrular. Hatalı input → false (throw etmez).
 */
export async function verifyBls(
  publicKeyHex: string,
  message: Uint8Array,
  signatureHex: string,
): Promise<boolean> {
  try {
    const bls = await getBls();
    const pk = bls.G1Element.from_bytes(hexToBytes(publicKeyHex));
    const sig = bls.G2Element.from_bytes(hexToBytes(signatureHex));
    return bls.PopSchemeMPL.verify(pk, message, sig);
  } catch {
    return false;
  }
}
