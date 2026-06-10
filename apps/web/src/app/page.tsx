import Link from 'next/link';

import { WalletPanel } from '@/features/connect-wallet/ui/WalletPanel';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">GalataBaker</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Decentralized baking and delegation for the Tezos network. Testnet MVP.
        </p>

        <section className="mt-8 flex flex-col items-center gap-2">
          <WalletPanel />
        </section>

        <nav className="mt-10 flex flex-wrap justify-center gap-3 text-sm">
          <Link
            href="/dashboard"
            className="rounded-md border border-input bg-background px-4 py-2 transition-colors hover:bg-accent"
          >
            Dashboard
          </Link>
          <Link
            href="/delegate"
            className="rounded-md border border-input bg-background px-4 py-2 transition-colors hover:bg-accent"
          >
            Delegate
          </Link>
          <Link
            href="/rewards"
            className="rounded-md border border-input bg-background px-4 py-2 transition-colors hover:bg-accent"
          >
            Rewards
          </Link>
          <Link
            href="/sign-in"
            className="rounded-md border border-input bg-background px-4 py-2 transition-colors hover:bg-accent"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </main>
  );
}
