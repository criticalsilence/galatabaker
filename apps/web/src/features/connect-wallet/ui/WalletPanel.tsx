'use client';

import { useWallet } from '../model';

import { ConnectButton } from './ConnectButton';
import { WalletInfo } from './WalletInfo';

import { extractErrorMessage } from '@/lib/error';

/** Top-level wallet widget. Mounted in the landing page. */
export function WalletPanel() {
  const { state, error } = useWallet();
  return (
    <div className="flex flex-col items-center gap-2">
      {state === 'connected' ? <WalletInfo /> : <ConnectButton />}
      {error && state === 'error' ? (
        <p role="alert" className="max-w-xs text-center text-xs text-destructive">
          {extractErrorMessage(new Error(error))}
        </p>
      ) : null}
    </div>
  );
}
