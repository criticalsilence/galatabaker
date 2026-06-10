'use client';

/**
 * TanStack Query provider for the whole app.
 *
 * Why client-only: QueryClient holds state in memory; creating one in
 * a server component would leak across requests. We mount it once,
 * inside a 'use client' boundary.
 *
 * Defaults:
 *   - staleTime: 30s — bakers list, rewards, delegations are slow-changing
 *   - gcTime: 5min — keep rarely-used queries warm
 *   - retry: 1 — the API is local on the same network; transient
 *     errors should not aggressively retry (would amplify load)
 *   - refetchOnWindowFocus: false — protects backend from chatty tabs
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
