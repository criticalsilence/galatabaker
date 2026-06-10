import { DashboardClient } from './dashboard-client';

import type { HealthResponse } from '@/features/api/health';
import { API_BASE_URL } from '@/lib/api-config';

/**
 * Server-rendered dashboard.
 *
 * Network health is server-side fetched (no client JS for that card).
 * Bakers list is fully client-side (TanStack Query) with a server-side
 * fallback for the initial paint via revalidate: 30.
 */

export const dynamic = 'force-dynamic';

async function fetchHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as HealthResponse;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const health = await fetchHealth();
  return <DashboardClient health={health} />;
}
