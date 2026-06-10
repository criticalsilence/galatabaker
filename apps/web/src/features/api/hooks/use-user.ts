'use client';

/**
 * TanStack Query hooks for /api/users/:walletPkh and sub-resources.
 *
 * Read endpoint (findByPkh) is public — anyone can see if a wallet is
 * registered. The email / preferences / consent / delete endpoints all
 * require a JWT and assert the caller is the owner of the wallet
 * (server-side check in users.controller.ts).
 */

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

import { apiDelete, apiGet, apiPut } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export interface UserPublic {
  id: string;
  walletPkh: string;
  role: 'USER' | 'ADMIN';
  emailMasked: string | null;
  emailVerified: boolean;
  telegramChatIdMasked: string | null;
  telegramVerified: boolean;
  consentGivenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  emailEnabled: boolean;
  telegramEnabled: boolean;
  rewardNotify: boolean;
  delegationNotify: boolean;
  cycleDigest: boolean;
}

export const USER_QUERY_KEY = ['user'] as const;

export function useUser(
  walletPkh: string | null | undefined,
  options?: Omit<UseQueryOptions<UserPublic>, 'queryKey' | 'queryFn' | 'enabled'>,
) {
  return useQuery<UserPublic>({
    queryKey: [...USER_QUERY_KEY, walletPkh],
    queryFn: () => apiGet<UserPublic>(`/users/${walletPkh}`),
    enabled: Boolean(walletPkh),
    ...options,
  });
}

export function useCurrentUser(
  options?: Omit<UseQueryOptions<UserPublic>, 'queryKey' | 'queryFn' | 'enabled'>,
) {
  const walletPkh = useAuthStore((s) => s.walletPkh);
  return useUser(walletPkh, options);
}

export function useUpdateEmail() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  return useMutation<{ verificationToken: string }, Error, { walletPkh: string; email: string }>({
    mutationFn: ({ walletPkh, email }) =>
      apiPut<{ verificationToken: string }>(`/users/${walletPkh}/email`, { email }, { token }),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: [...USER_QUERY_KEY, vars.walletPkh] });
    },
  });
}

export function useUpdatePreferences() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  return useMutation<
    UserPreferences,
    Error,
    { walletPkh: string; prefs: Partial<UserPreferences> }
  >({
    mutationFn: ({ walletPkh, prefs }) =>
      apiPut<UserPreferences>(`/users/${walletPkh}/preferences`, prefs, { token }),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: [...USER_QUERY_KEY, vars.walletPkh] });
    },
  });
}

export function useUpdateConsent() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  return useMutation<
    { consentGivenAt: string | null },
    Error,
    { walletPkh: string; given: boolean }
  >({
    mutationFn: ({ walletPkh, given }) =>
      apiPut<{ consentGivenAt: string | null }>(
        `/users/${walletPkh}/consent`,
        { given },
        { token },
      ),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: [...USER_QUERY_KEY, vars.walletPkh] });
    },
  });
}

export function useDeleteAccount() {
  const token = useAuthStore((s) => s.token);
  const signOut = useAuthStore((s) => s.signOut);
  return useMutation<void, Error, { walletPkh: string }>({
    mutationFn: ({ walletPkh }) => apiDelete<void>(`/users/${walletPkh}`, { token }),
    onSuccess: () => {
      signOut();
    },
  });
}
