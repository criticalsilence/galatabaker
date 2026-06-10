'use client';

/**
 * TanStack Query hooks for /api/rewards.
 *
 * Rewards are read-only for the user (the indexer creates them, the user
 * only "claims" them). The claim endpoint takes an opsHash and a
 * claimedOpsHash; the second one is the actual claim op the user's
 * wallet broadcast.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet, apiPost } from '@/lib/api-client';

export type RewardKind = 'BAKING' | 'ENDORSEMENT' | 'FEE' | 'SUBSIDY' | 'REVELATION';

export interface RewardItem {
  id: string;
  walletPkh: string;
  cycle: number;
  kind: RewardKind;
  amount: string;
  bakerPkh: string;
  opsHash: string;
  claimed: boolean;
  claimedOpsHash: string | null;
  blockTime: string;
  createdAt: string;
}

export interface CycleBreakdownEntry {
  cycle: number;
  total: string;
}

export interface ListRewardsResult {
  data: RewardItem[];
  total: number;
  totalAmount: string;
  cycleBreakdown: CycleBreakdownEntry[];
  limit: number;
  offset: number;
}

export interface ListRewardsQuery {
  cycle?: number;
  kind?: RewardKind;
  limit?: number;
  offset?: number;
}

export const REWARDS_QUERY_KEY = ['rewards'] as const;

export function useRewards(walletPkh: string | null | undefined, query: ListRewardsQuery = {}) {
  return useQuery<ListRewardsResult>({
    queryKey: [...REWARDS_QUERY_KEY, walletPkh, query],
    queryFn: () => apiGet<ListRewardsResult>(`/rewards/${walletPkh}`, { query }),
    enabled: Boolean(walletPkh),
  });
}

export function useClaimReward() {
  const queryClient = useQueryClient();
  return useMutation<RewardItem, Error, { opsHash: string; claimedOpsHash: string }>({
    mutationFn: ({ opsHash, claimedOpsHash }) =>
      apiPost<RewardItem>('/rewards/claim', { opsHash, claimedOpsHash }),
    onSuccess: () => {
      // We don't know the walletPkh from the response shape (no include),
      // so the caller is responsible for invalidating the right key.
      void queryClient.invalidateQueries({ queryKey: REWARDS_QUERY_KEY });
    },
  });
}
