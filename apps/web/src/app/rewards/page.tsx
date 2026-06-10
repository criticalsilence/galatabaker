'use client';

import Link from 'next/link';

import { useRewards } from '@/features/api/hooks/use-rewards';
import { useWallet } from '@/features/connect-wallet/model';
import { useAuthStore } from '@/lib/auth-store';
import { mutezToTez, truncateAddress } from '@/lib/format';

export default function RewardsPage() {
  const walletPkh = useWallet((s) => s.address);
  const isAuthed = useAuthStore((s) => s.isAuthenticated());
  const { data, isPending, error } = useRewards(walletPkh, { limit: 50 });

  if (!walletPkh) {
    return (
      <main className="container mx-auto px-4 py-12">
        <h1 className="mb-4 text-3xl font-bold">Rewards</h1>
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Connect your wallet to view your rewards.</p>
        </div>
        <Link
          href="/"
          className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← back
        </Link>
      </main>
    );
  }
  if (!isAuthed) {
    return (
      <main className="container mx-auto px-4 py-12">
        <h1 className="mb-4 text-3xl font-bold">Rewards</h1>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900">
          <p className="font-semibold">Sign in to view your rewards</p>
          <p className="mt-1 text-sm">
            Rewards are tied to a SIWW session — go back and click "Sign in with this wallet".
          </p>
          <Link href="/" className="mt-3 inline-block text-sm text-primary hover:underline">
            ← back to landing
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Rewards</h1>
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← dashboard
        </Link>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Failed to load: {error.message}
        </p>
      ) : isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data ? (
        <RewardsView data={data} />
      ) : null}
    </main>
  );
}

function RewardsView({
  data,
}: {
  data: import('@/features/api/hooks/use-rewards').ListRewardsResult;
}) {
  return (
    <>
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <Stat label="Total rewards" value={`${mutezToTez(data.totalAmount)} tez`} />
        <Stat label="Total entries" value={data.total.toLocaleString()} />
        <Stat label="Cycles" value={String(data.cycleBreakdown.length)} />
      </section>

      {data.cycleBreakdown.length ? (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">By cycle</h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Cycle</th>
                  <th className="px-4 py-2 text-right">Total (tez)</th>
                </tr>
              </thead>
              <tbody>
                {data.cycleBreakdown.map((c) => (
                  <tr key={c.cycle} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2 tabular-nums">{c.cycle}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{mutezToTez(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Entries</h2>
        {data.data.length ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Cycle</th>
                  <th className="px-4 py-2 text-left">Kind</th>
                  <th className="px-4 py-2 text-left">Baker</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-left">Block time</th>
                  <th className="px-4 py-2 text-left">Claimed</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2 tabular-nums">{r.cycle}</td>
                    <td className="px-4 py-2">{r.kind}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {truncateAddress(r.bakerPkh, 8, 4)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{mutezToTez(r.amount)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(r.blockTime).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {r.claimed ? (
                        <span className="text-green-700">claimed</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No rewards yet for this wallet.</p>
        )}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
