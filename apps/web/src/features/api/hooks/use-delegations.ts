'use client';

/**
 * TanStack Query hooks for /api/delegations.
 *
 * POST /delegations is called by apps/web right after the Beacon wallet
 * broadcasts the operation. The list query is the user's delegation
 * history (paginated, filterable by status).
 *
 * Auth: POST is public (the source-of-truth for the op is the chain
 * itself, anyone can submit). GET is also public (no PII, no balances).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet, apiPost } from '@/lib/api-client';

export type DelegationStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

export interface DelegationItem {
  id: string;
  walletPkh: string;
  bakerPkh: string;
  bakerAlias: string | null;
  amount: string;
  opsHash: string | null;
  status: DelegationStatus;
  blockLevel: number | null;
  blockTime: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListDelegationsResult {
  data: DelegationItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListDelegationsQuery {
  status?: DelegationStatus;
  limit?: number;
  offset?: number;
}

export interface CreateDelegationInput {
  walletPkh: string;
  bakerPkh: string;
  amount: string;
  opsHash: string;
}

export const DELEGATIONS_QUERY_KEY = ['delegations'] as const;

export function useDelegations(
  walletPkh: string | null | undefined,
  query: ListDelegationsQuery = {},
) {
  return useQuery<ListDelegationsResult>({
    queryKey: [...DELEGATIONS_QUERY_KEY, walletPkh, query],
    queryFn: () => apiGet<ListDelegationsResult>(`/delegations/${walletPkh}`, { query }),
    enabled: Boolean(walletPkh),
  });
}

export function useCreateDelegation() {
  const queryClient = useQueryClient();
  return useMutation<DelegationItem, Error, CreateDelegationInput>({
    mutationFn: (input) => apiPost<DelegationItem>('/delegations', input),
    onSuccess: (item) => {
      void queryClient.invalidateQueries({
        queryKey: [...DELEGATIONS_QUERY_KEY, item.walletPkh],
      });
    },
  });
}
