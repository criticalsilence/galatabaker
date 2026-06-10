'use client';

import { useState } from 'react';

import { useWallet } from '../model';

import { truncateAddress } from '@/lib/format';

/** Shown after a successful connect: truncated address + disconnect. */
export function WalletInfo() {
  const address = useWallet((s) => s.address);
  const disconnect = useWallet((s) => s.disconnect);
  const [showFull, setShowFull] = useState(false);
  if (!address) return null;

  return (
    <div className="flex items-center gap-2">
      <code
        className="rounded-md bg-muted px-3 py-2 font-mono text-sm"
        data-testid="wallet-address"
      >
        {showFull ? address : truncateAddress(address)}
      </code>
      <button
        type="button"
        onClick={() => setShowFull((s) => !s)}
        className="text-xs text-muted-foreground hover:text-foreground"
        aria-label={showFull ? 'Hide full address' : 'Show full address'}
      >
        {showFull ? 'hide' : 'show'}
      </button>
      <button
        type="button"
        onClick={() => void disconnect()}
        className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        data-testid="disconnect-wallet"
      >
        Disconnect
      </button>
    </div>
  );
}
