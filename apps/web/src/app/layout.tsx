import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GalataBaker — Tezos Baking & Staking',
  description: 'Decentralized baking and delegation for the Tezos network (Bakingnet testnet MVP).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
