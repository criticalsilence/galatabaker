'use client';

import { useEffect } from 'react';

import { useWallet } from '../model';

import { signIn, signOut } from '@/lib/auth';
import { useAuthStore } from '@/lib/auth-store';
import { extractErrorMessage } from '@/lib/error';

/**
 * SIWW sign-in / sign-out toggle.
 *
 * Visible only when the wallet is connected. Shows one of:
 *   - "Sign in with this wallet"  → no JWT in localStorage
 *   - "Sign out"                  → JWT present, click clears it
 *
 * Sign-in flow orchestrates the full SIWW dance (challenge → sign →
 * verify) via lib/auth.signIn(). On success the auth-store is updated
 * with the new JWT, which unlocks all the authed hooks (useUser, etc.).
 */
export function SignInButton() {
  const walletState = useWallet((s) => s.state);
  const auth = useAuthStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  // Clear stale signInError on wallet state changes (e.g. user
  // disconnected → reconnected).
  useEffect(() => {
    if (walletState === 'idle' || walletState === 'error') {
      if (auth.signInError) {
        useAuthStore.getState().setSignInError('');
      }
    }
  }, [walletState, auth.signInError]);

  // Not connected — let the parent (ConnectButton) handle it.
  if (walletState !== 'connected') return null;

  if (isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => signOut()}
        className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        Sign out
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={auth.isSigningIn}
        onClick={() => {
          void signIn();
        }}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {auth.isSigningIn ? 'Signing in…' : 'Sign in with this wallet'}
      </button>
      {auth.signInError ? (
        <p role="alert" className="max-w-xs text-center text-xs text-destructive">
          {extractErrorMessage(new Error(auth.signInError))}
        </p>
      ) : null}
    </div>
  );
}
