'use client';

import Link from 'next/link';

import { DashboardBakersLive } from './dashboard-bakers-live';

import type { HealthResponse } from '@/features/api/health';
import { WalletPanel } from '@/features/connect-wallet/ui/WalletPanel';
import { useAuthStore } from '@/lib/auth-store';
import { truncateAddress } from '@/lib/format';

/**
 * Client half of /dashboard.
 *
 * Server component passes in health (or null on error). Client adds
 * wallet + SIWW status from Zustand, and a live-refreshing bakers table.
 */
export function DashboardClient({ health }: { health: HealthResponse | null }) {
  const walletPkh = useAuthStore((s) => s.walletPkh);
  const isAuthed = useAuthStore((s) => s.isAuthenticated());

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← back
        </Link>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Network</h3>
          {health ? (
            <p className="mt-1 text-lg font-semibold text-green-700">
              {health.status}{' '}
              <span className="text-xs text-muted-foreground">
                ({health.service} v{health.version})
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-destructive">unreachable</p>
          )}
          {health ? (
            <p className="mt-1 text-xs text-muted-foreground">
              uptime {Math.floor(health.uptime / 60)} min ·{' '}
              {new Date(health.timestamp).toLocaleTimeString()}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Wallet</h3>
          {walletPkh ? (
            <p className="mt-1 font-mono text-sm">{truncateAddress(walletPkh)}</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">not connected</p>
          )}
          {walletPkh ? (
            isAuthed ? (
              <p className="mt-1 text-xs text-green-700">signed in</p>
            ) : (
              <p className="mt-1 text-xs text-amber-700">connected, not signed in</p>
            )
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Quick actions</h3>
          <ul className="mt-1 space-y-1 text-sm">
            <li>
              <Link href="/delegate" className="text-primary hover:underline">
                Delegate →
              </Link>
            </li>
            <li>
              <Link href="/rewards" className="text-primary hover:underline">
                View rewards →
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Your wallet</h2>
        <WalletPanel />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Top 5 bakers</h2>
        <DashboardBakersLive />
        <p className="mt-3 text-xs text-muted-foreground">
          Refreshes every 60s. Data via TzKT, mirrored in the API's local DB.
        </p>
      </section>
    </main>
  );
}
