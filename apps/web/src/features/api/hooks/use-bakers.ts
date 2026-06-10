'use client';

/**
 * TanStack Query hooks for /api/bakers.
 *
 * Bakers are slow-changing (5 minute indexer sync), so staleTime is
 * cranked to 60s here (vs 30s default in QueryProvider). The list
 * query uses the URL-friendly query shape; the detail query takes a
 * raw pkh. Both are public — no Authorization header.
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { apiGet } from '@/lib/api-client';

export type BakerSortField = 'totalStake' | 'fee' | 'blocksBaked';
export type SortOrder = 'asc' | 'desc';

export interface BakerListItem {
  pkh: string;
  alias: string | null;
  status: string;
  fee: number;
  totalStake: string;
  delegatedBalance: string;
  capacity: string;
  blocksBaked: number;
}

export interface ListBakersQuery {
  limit?: number;
  sort?: BakerSortField;
  order?: SortOrder;
}

export interface ListBakersResult {
  data: BakerListItem[];
  total: number;
  limit: number;
  sort: BakerSortField;
  order: SortOrder;
}

export const BAKERS_QUERY_KEY = ['bakers'] as const;

export function useBakers(
  query: ListBakersQuery = {},
  options?: Omit<UseQueryOptions<ListBakersResult>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ListBakersResult>({
    queryKey: [...BAKERS_QUERY_KEY, query],
    queryFn: () => apiGet<ListBakersResult>('/bakers', { query }),
    staleTime: 60_000,
    ...options,
  });
}

export function useBaker(
  pkh: string | undefined,
  options?: Omit<UseQueryOptions<BakerListItem>, 'queryKey' | 'queryFn' | 'enabled'>,
) {
  return useQuery<BakerListItem>({
    queryKey: [...BAKERS_QUERY_KEY, pkh],
    queryFn: () => apiGet<BakerListItem>(`/bakers/${pkh}`),
    enabled: Boolean(pkh),
    staleTime: 60_000,
    ...options,
  });
}
