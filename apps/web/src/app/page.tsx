import nextDynamic from 'next/dynamic';
import Link from 'next/link';

// Beacon wallet yalnizca browser'da yasar (localStorage + WebSocket).
// SSR sirasinda yuklenmesin diye nextDynamic + ssr:false kullaniyoruz.
const WalletConnect = nextDynamic(
  () => import('@/components/wallet-connect').then((m) => m.WalletConnect),
  {
    ssr: false,
    loading: () => (
      <button
        type="button"
        disabled
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-50"
      >
        Connect Wallet
      </button>
    ),
  },
);

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-16">
      <section className="text-center">
        <h1 className="text-5xl font-bold tracking-tight">GalataBaker</h1>
        <p className="mt-4 text-xl text-muted-foreground">
          Tezos baking and delegation, made simple.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">MVP — Bakingnet testnet</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <WalletConnect />
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Open Dashboard
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-6 sm:grid-cols-3">
        <FeatureCard title="Wallet Connect" body="Temple, Kukai, Galleon via Beacon SDK 4" />
        <FeatureCard title="Delegate" body="Trustless delegation to active bakers" />
        <FeatureCard title="Track Rewards" body="Read-only balance and reward history" />
      </section>

      <footer className="mt-16 border-t pt-8 text-center text-sm text-muted-foreground">
        <p>Security-first. Private keys never leave your wallet.</p>
      </footer>
    </main>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
