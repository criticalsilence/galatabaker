export const dynamic = 'force-static';

export default function DelegatePage() {
  return (
    <main className="container mx-auto px-4 py-12">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Delegate</h1>
        <a href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← Dashboard
        </a>
      </header>

      <section className="rounded-lg border bg-card p-8 text-card-foreground shadow-sm">
        <h2 className="text-xl font-semibold">Coming in Adım 5</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Delegation flow needs a connected wallet and a target baker. In the MVP (Bakingnet
          testnet) you will be able to:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-muted-foreground">
          <li>Browse the active baker set via TzKT</li>
          <li>Delegate to a chosen baker (signing via Beacon)</li>
          <li>Re-delegate or withdraw at any time</li>
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          Until then, test in your wallet (Temple) directly on the Bakingnet faucet.
        </p>
      </section>
    </main>
  );
}
