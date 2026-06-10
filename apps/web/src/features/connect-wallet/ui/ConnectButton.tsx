'use client';

import { useEffect } from 'react';

import { useWallet } from '../model';

/** Shown when wallet is not connected. Mounts → kicks off restore. */
export function ConnectButton() {
  const state = useWallet((s) => s.state);
  const connect = useWallet((s) => s.connect);
  // Single mount → run restore exactly once. Strict-mode-safe because
  // restore is idempotent (it just re-reads Beacon localStorage).
  useEffect(() => {
    void useWallet.getState().restore();
  }, []);

  const disabled = state === 'connecting' || state === 'restoring';
  const label =
    state === 'connecting'
      ? 'Connecting…'
      : state === 'restoring'
        ? 'Restoring…'
        : 'Connect Wallet';

  return (
    <button
      type="button"
      onClick={() => void connect()}
      disabled={disabled}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      data-testid="connect-wallet"
    >
      {label}
    </button>
  );
}
