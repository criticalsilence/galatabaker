'use client';

import { useRouter } from 'next/navigation';

import { useBakers } from '@/features/api/hooks/use-bakers';

export function DashboardBakersLive() {
  const router = useRouter();
  const { data, isPending, error } = useBakers({ limit: 5, sort: 'totalStake', order: 'desc' });

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading bakers…</p>;
  }
  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Failed to load: {error.message}
      </p>
    );
  }
  const rows = data?.data ?? [];
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">No bakers yet — indexer may not have synced.</p>
    );
  }
  return (
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
          {rows.map((b) => (
            <tr key={b.pkh} className="border-b border-border last:border-b-0 hover:bg-muted/30">
              <td className="px-4 py-2">
                <p className="font-medium">
                  {b.alias ?? <span className="text-muted-foreground">(unnamed)</span>}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {b.pkh.slice(0, 12)}…{b.pkh.slice(-4)}
                </p>
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{(b.fee / 100).toFixed(2)}%</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {(Number(b.totalStake) / 1_000_000).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {b.blocksBaked.toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right">
                <button
                  type="button"
                  onClick={() => router.push(`/delegate?baker=${b.pkh}`)}
                  className="text-primary hover:underline"
                >
                  delegate
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
