'use client';

import Link from 'next/link';

import { WalletPanel } from '@/features/connect-wallet/ui/WalletPanel';
import { useAuthStore } from '@/lib/auth-store';
import { truncateAddress } from '@/lib/format';

export default function SignInPage() {
  const walletPkh = useAuthStore((s) => s.walletPkh);
  const isAuthed = useAuthStore((s) => s.isAuthenticated());

  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
        <h1 className="mb-2 text-2xl font-bold">Sign in</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          GalataBaker uses Sign-In With Wallet (SIWW) — no email, no password. Your wallet is your
          identity.
        </p>

        <WalletPanel />

        {walletPkh && isAuthed ? (
          <div className="mt-6 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            ✓ Signed in as <code className="font-mono">{truncateAddress(walletPkh)}</code>
            <div className="mt-3 flex gap-2">
              <Link href="/dashboard" className="text-primary hover:underline">
                → dashboard
              </Link>
              <Link href="/rewards" className="text-primary hover:underline">
                → rewards
              </Link>
            </div>
          </div>
        ) : null}

        <p className="mt-6 text-xs text-muted-foreground">
          Need a wallet? Install{' '}
          <a
            className="text-primary hover:underline"
            href="https://templewallet.com"
            target="_blank"
            rel="noreferrer"
          >
            Temple
          </a>{' '}
          or{' '}
          <a
            className="text-primary hover:underline"
            href="https://wallet.kukai.app"
            target="_blank"
            rel="noreferrer"
          >
            Kukai
          </a>
          .
        </p>
      </div>
      <Link href="/" className="mt-4 text-sm text-muted-foreground hover:text-foreground">
        ← back to landing
      </Link>
    </main>
  );
}
