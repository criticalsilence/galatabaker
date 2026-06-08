import { truncateAddress } from '@/lib/format';
import { getTzktClient, USHUAIA_TESTNET } from '@/lib/sdk-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const tzkt = getTzktClient();
  let headLevel: number | null = null;
  let headTimestamp: string | null = null;
  let tzktError: string | null = null;
  try {
    const head = await tzkt.getHead();
    headLevel = head.level;
    headTimestamp = head.timestamp;
  } catch (e) {
    tzktError = e instanceof Error ? e.message : 'TzKT is unavailable';
  }

  return (
    <main className="container mx-auto px-4 py-12">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Home
        </a>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Network" value={USHUAIA_TESTNET.name} />
        <StatCard
          label="RPC endpoint"
          value={truncateAddress(USHUAIA_TESTNET.rpcUrl.replace(/^https?:\/\//, ''), 24, 0)}
        />
        <StatCard
          label="Block height"
          value={headLevel !== null ? headLevel.toLocaleString() : '—'}
          sub={headTimestamp ?? undefined}
        />
      </section>

      {tzktError && (
        <section className="mt-8 rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <h2 className="font-semibold text-destructive">Indexer unreachable</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tzktError}</p>
        </section>
      )}

      <section className="mt-12 grid gap-6 sm:grid-cols-2">
        <ActionCard
          href="/delegate"
          title="Delegate"
          body="Delegate your tez to a baker and earn rewards."
        />
        <ActionCard href="/rewards" title="Rewards" body="View your pending and claimed rewards." />
      </section>
    </main>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ActionCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <a
      href={href}
      className="block rounded-lg border bg-card p-6 text-card-foreground shadow-sm transition-colors hover:bg-accent"
    >
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </a>
  );
}
