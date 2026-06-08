export const dynamic = 'force-static';

export default function RewardsPage() {
  return (
    <main className="container mx-auto px-4 py-12">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Rewards</h1>
        <a href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← Dashboard
        </a>
      </header>

      <section className="rounded-lg border bg-card p-8 text-card-foreground shadow-sm">
        <h2 className="text-xl font-semibold">Coming in Adım 5</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Rewards dashboard will read-only mirror baker payouts from TzKT:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-muted-foreground">
          <li>Total claimable tez for your address</li>
          <li>Per-cycle payout history</li>
          <li>Effective yield (annualized)</li>
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          No claim happens server-side. Rewards are credited by the protocol; you simply watch.
        </p>
      </section>
    </main>
  );
}
