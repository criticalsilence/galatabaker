'use client';

import { useState } from 'react';

import { useWallet } from '../model';

import { SignInButton } from './SignInButton';

import { useAuthStore } from '@/lib/auth-store';
import { truncateAddress } from '@/lib/format';

/** Shown after a successful wallet connect. */
export function WalletInfo() {
  const { address, disconnect } = useWallet();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const [showFull, setShowFull] = useState(false);
  if (!address) return null;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <code className="rounded-md bg-muted px-3 py-2 font-mono text-sm">
          {showFull ? address : truncateAddress(address)}
        </code>
        <button
          type="button"
          onClick={() => setShowFull((s) => !s)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {showFull ? 'hide' : 'show'}
        </button>
        {isAuthenticated ? (
          <span
            className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
            title="Signed in (SIWW JWT active)"
          >
            signed in
          </span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <SignInButton />
        <button
          type="button"
          onClick={() => {
            void disconnect();
          }}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Disconnect wallet
        </button>
      </div>
    </div>
  );
}
