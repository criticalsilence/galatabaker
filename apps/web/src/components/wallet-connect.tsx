'use client';

import { useEffect, useState } from 'react';

import { truncateAddress } from '@/lib/format';
import { useWallet } from '@/store/wallet';

const INSTALL_HINT = 'Not installed? Get Temple, Kukai, or Galleon for your browser.';

export function WalletConnect() {
  const {
    address,
    isConnected,
    isConnecting,
    isRestoring,
    error,
    connect,
    disconnect,
    restoreSession,
  } = useWallet();
  const [showFull, setShowFull] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Mount: Beacon SDK'nın kayıtlı active account'unu restore et.
  // Bir kez çalışır; ikinci mount'larda state zaten doğru olur.
  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  if (isRestoring) {
    return (
      <button
        type="button"
        disabled
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-50"
        data-testid="wallet-restoring"
      >
        Restoring…
      </button>
    );
  }

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
          onClick={() => void disconnect()}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          data-testid="disconnect-wallet"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Hata "no wallet" mu? Kurulum talimatlarını göster.
  const isNoWalletError =
    error && /(no wallet|wallet not found|no beacon|beacon wallet.*not.*found)/i.test(error);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void connect()}
          disabled={isConnecting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          data-testid="connect-wallet"
        >
          {isConnecting ? 'Connecting…' : 'Connect Wallet'}
        </button>
        <button
          type="button"
          onClick={() => setShowHelp((s) => !s)}
          className="text-xs text-muted-foreground hover:text-foreground"
          aria-label="Installation help"
          data-testid="wallet-help"
        >
          {showHelp ? '✕' : '(?)'}
        </button>
      </div>

      {showHelp && (
        <p className="max-w-md text-center text-xs text-muted-foreground">{INSTALL_HINT}</p>
      )}

      {isNoWalletError && (
        <div className="max-w-md rounded-md border border-amber-500/40 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold">No Tezos wallet extension found.</p>
          <p className="mt-1">Install one, then refresh this page:</p>
          <ul className="mt-1 list-disc pl-4">
            <li>
              <a
                className="underline"
                href="https://templewallet.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Temple
              </a>{' '}
              (Chrome / Firefox)
            </li>
            <li>
              <a
                className="underline"
                href="https://wallet.kukai.app/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Kukai
              </a>{' '}
              (Chrome / Firefox / Edge)
            </li>
            <li>
              <a
                className="underline"
                href="https://galleon-wallet.app/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Galleon
              </a>{' '}
              (Chrome)
            </li>
          </ul>
        </div>
      )}

      {error && !isNoWalletError && (
        <p className="max-w-md text-center text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
