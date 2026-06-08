'use client';

import { useState } from 'react';

import { truncateAddress } from '@/lib/format';
import { useWallet } from '@/store/wallet';

export function WalletConnect() {
  const { address, isConnected, isConnecting, error, connect, disconnect } = useWallet();
  const [showFull, setShowFull] = useState(false);

  if (isConnected && address) {
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
          onClick={disconnect}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={connect}
        disabled={isConnecting}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        data-testid="connect-wallet"
      >
        {isConnecting ? 'Connecting…' : 'Connect Wallet'}
      </button>
      {error && (
        <p className="max-w-md text-center text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
