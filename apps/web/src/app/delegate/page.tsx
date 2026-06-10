'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { useBakers } from '@/features/api/hooks/use-bakers';
import { useWallet } from '@/features/connect-wallet/model';
import { truncateAddress } from '@/lib/format';

/**
 * /delegate — baker list + manual delegation instructions.
 *
 * MVP scope: we don't broadcast a delegation op from this page
 * (Beacon's `requestOperation` adds ~150kB and a wallet-specific
 * deep-link path we don't need for testnet discovery). Instead we
 * show the baker's pkh + a copy-to-clipboard button and a deep
 * link to the user's wallet (Temple/Kukai) for the actual op.
 *
 * useSearchParams forces a Suspense boundary in Next 15 — the
 * boundary is the default export, and the content lives in an
 * inner component.
 */
export default function DelegatePage() {
  return (
    <Suspense fallback={<DelegateSkeleton />}>
      <DelegateContent />
    </Suspense>
  );
}

function DelegateSkeleton() {
  return (
    <main className="container mx-auto px-4 py-12">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </main>
  );
}

function DelegateContent() {
  const router = useRouter();
  const params = useSearchParams();
  const presetBaker = params.get('baker');
  const walletAddress = useWallet((s) => s.address);

  const [search, setSearch] = useState('');
  const { data, isPending, error } = useBakers({ limit: 50, sort: 'totalStake', order: 'desc' });

  const rows = (data?.data ?? []).filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (b.alias ?? '').toLowerCase().includes(q) || b.pkh.toLowerCase().includes(q);
  });

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Delegate</h1>
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← dashboard
        </Link>
      </div>

      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Testnet MVP — manual delegation</p>
        <p className="mt-1">
          Pick a baker below, copy their address, and use your wallet (Temple / Kukai) to send a
          delegation operation. The address you delegate FROM is{' '}
          <code className="rounded bg-amber-100 px-1 font-mono text-xs">
            {walletAddress ?? '(connect wallet first)'}
          </code>
          .
        </p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by alias or pkh…"
        className="mb-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Failed to load: {error.message}
        </p>
      ) : isPending ? (
        <p className="text-sm text-muted-foreground">Loading bakers…</p>
      ) : !rows.length ? (
        <p className="text-sm text-muted-foreground">No bakers match.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Baker</th>
                <th className="px-4 py-2 text-right">Fee</th>
                <th className="px-4 py-2 text-right">Stake (tez)</th>
                <th className="px-4 py-2 text-right">Blocks</th>
                <th className="px-4 py-2 text-right" />
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const isPreset = presetBaker === b.pkh;
                return (
                  <tr
                    key={b.pkh}
                    className={`border-b border-border last:border-b-0 ${
                      isPreset ? 'bg-primary/5' : 'hover:bg-muted/30'
                    }`}
                  >
                    <td className="px-4 py-2">
                      <p className="font-medium">
                        {b.alias ?? <span className="text-muted-foreground">(unnamed)</span>}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {truncateAddress(b.pkh, 10, 6)}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {(b.fee / 100).toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {(Number(b.totalStake) / 1_000_000).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {b.blocksBaked.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <CopyBakerButton pkh={b.pkh} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Once the delegation operation is included in a block, the indexer (Step 6) will pick it up
        and your delegation will appear on the{' '}
        <Link href="/rewards" className="text-primary hover:underline">
          rewards page
        </Link>
        .{' '}
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="text-primary hover:underline"
        >
          ← back to dashboard
        </button>
      </p>
    </main>
  );
}

function CopyBakerButton({ pkh }: { pkh: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(pkh);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard blocked — ignore */
        }
      }}
      className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
    >
      {copied ? '✓ copied' : 'copy pkh'}
    </button>
  );
}
