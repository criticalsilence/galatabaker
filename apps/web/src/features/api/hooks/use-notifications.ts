'use client';

/**
 * TanStack Query hooks for /api/notifications.
 *
 * All endpoints require a JWT (the server asserts the token's sub
 * matches the URL walletPkh). Read for the in-app inbox, mark-read
 * for the per-row read state, unread-count for the bell badge.
 */

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

import { apiGet, apiPost } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export type NotificationChannelType = 'EMAIL' | 'TELEGRAM';

export interface NotificationPublic {
  id: string;
  channel: NotificationChannelType;
  subject: string;
  body: string;
  sent: boolean;
  sentAt: string | null;
  error: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ListNotificationsResult {
  data: NotificationPublic[];
  total: number;
  unreadCount: number;
}

export interface ListNotificationsQuery {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

export const NOTIFICATIONS_QUERY_KEY = ['notifications'] as const;

export function useNotifications(
  walletPkh: string | null | undefined,
  query: ListNotificationsQuery = {},
  options?: Omit<UseQueryOptions<ListNotificationsResult>, 'queryKey' | 'queryFn' | 'enabled'>,
) {
  const token = useAuthStore((s) => s.token);
  return useQuery<ListNotificationsResult>({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, walletPkh, query],
    queryFn: () => apiGet<ListNotificationsResult>(`/notifications/${walletPkh}`, { token, query }),
    enabled: Boolean(walletPkh) && Boolean(token),
    ...options,
  });
}

export function useUnreadCount(walletPkh: string | null | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery<{ walletPkh: string; unreadCount: number }>({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, walletPkh, 'unread-count'],
    queryFn: () =>
      apiGet<{ walletPkh: string; unreadCount: number }>(
        `/notifications/${walletPkh}/unread-count`,
        { token },
      ),
    enabled: Boolean(walletPkh) && Boolean(token),
    // The bell badge is allowed to refetch on focus — the user is staring
    // at it. Backend just runs the same query, no extra load.
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}

export function useMarkRead(walletPkh: string) {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  return useMutation<NotificationPublic, Error, { id: string }>({
    mutationFn: ({ id }) =>
      apiPost<NotificationPublic>(`/notifications/${walletPkh}/${id}/read`, undefined, { token }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...NOTIFICATIONS_QUERY_KEY, walletPkh] });
    },
  });
}
