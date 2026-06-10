import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { QueryProvider } from './providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'GalataBaker — Tezos Baking & Staking',
  description: 'Decentralized baking and delegation for the Tezos network (Bakingnet testnet MVP).',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
