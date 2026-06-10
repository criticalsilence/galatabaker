'use client';

/**
 * SIWW (Sign-In With Wallet) flow — the client side.
 *
 *  1. GET  /api/auth/challenge → { nonce, message, expiresAt }
 *  2. message = canonical string (matches what server's
 *     auth.service.buildCanonicalMessage produces)
 *  3. wallet.signMessage(message) → { signature, publicKey } (TZIP-32)
 *  4. POST /api/auth/verify with { walletPkh, publicKey, signature,
 *     nonce, timestamp } → { accessToken, walletPkh, expiresAt }
 *  5. Persist via auth-store; on next reload, the user is "signed in"
 *     until JWT expires.
 *
 * The flow needs both the wallet SDK (for signing) and the auth-store
 * (for token persistence). We keep the orchestration here so feature
 * components can call \`signIn()\` without knowing about either.
 */

import { apiGet, apiPost } from './api-client';
import { useAuthStore } from './auth-store';

import { getOrCreateWallet } from '@/features/connect-wallet/beacon';

interface ChallengeResponse {
  nonce: string;
  message: string;
  expiresAt: number;
}

interface VerifyResponse {
  accessToken: string;
  walletPkh: string;
  expiresAt: number;
}

/**
 * Full SIWW flow. Resolves with the wallet address on success.
 * Throws on any failure (Beacon, server, network) — caller renders
 * the error.
 */
export async function signIn(): Promise<string> {
  const store = useAuthStore.getState();
  store.signInStart();
  try {
    // 1. Get challenge
    const challenge = await apiGet<ChallengeResponse>('/auth/challenge');

    // 2. Connect wallet (lazy — reuses singleton from beacon.ts)
    const wallet = await getOrCreateWallet();
    // Ensure the wallet has permission to sign. If the user connected
    // before, this resolves immediately; if not, it pops the Beacon
    // pairing screen.
    await wallet.requestPermissions();

    // 3. Sign the canonical message
    const { signature, publicKey } = await wallet.signMessage(challenge.message);

    // 4. Wallet address from Beacon (single source of truth for the
    //    address — we don't trust the SDK to derive it on the server)
    const account = await wallet.getActiveAccount();
    if (!account) throw new Error('No active account after sign');
    const walletPkh = account.address;

    // 5. Verify on server
    const result = await apiPost<VerifyResponse>('/auth/verify', {
      walletPkh,
      publicKey,
      signature,
      nonce: challenge.nonce,
      timestamp: Math.floor(Date.now() / 1000),
    });

    store.signInSuccess(result.accessToken, result.walletPkh, result.expiresAt);
    return result.walletPkh;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign-in failed';
    store.setSignInError(message);
    throw err;
  }
}

/** Clear local JWT + wallet connection. Does not call any API. */
export function signOut(): void {
  useAuthStore.getState().signOut();
}
