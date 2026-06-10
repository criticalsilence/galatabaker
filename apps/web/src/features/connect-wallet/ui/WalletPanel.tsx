'use client';

import { useWallet } from '../model';

import { ConnectButton } from './ConnectButton';
import { WalletInfo } from './WalletInfo';

/** Top-level wallet widget. Routes between connect CTA and connected info. */
export function WalletPanel() {
  const state = useWallet((s) => s.state);
  const error = useWallet((s) => s.error);
  const isConnected = state === 'connected';

  return (
    <div className="flex flex-col items-center gap-2">
      {isConnected ? <WalletInfo /> : <ConnectButton />}
      {error && (
        <p className="max-w-md text-center text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
