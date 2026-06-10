'use client';

/**
 * GalataBaker wallet feature — lazy Beacon wallet factory.
 *
 * Why this file exists separately from model.ts:
 * - `@galatabaker/sdk/wallet` is browser-only (Window, localStorage, WebSocket).
 *   The first time the user clicks "Connect" we dynamic-import it so the
 *   SDK never lands in the initial page bundle.
 * - The resulting `GalataBakerWallet` instance is a module-level singleton:
 *   the Zustand store, the ACTIVE_ACCOUNT_SET subscriber, and the
 *   disconnect handler all need to share the same instance.
 *
 * Pattern adapted from xsfunc/kolibri (src/features/connect-wallet/
 * model/model.ts) — Kolibri uses Effector, we use Zustand, the singleton +
 * dynamic-import shape is the same.
 */

import type { GalataBakerWallet } from '@galatabaker/sdk/wallet';

import { subscribeToActiveAccount } from './subscribe';

let _wallet: GalataBakerWallet | null = null;
let _unsubscribe: (() => void) | null = null;

export async function getOrCreateWallet(): Promise<GalataBakerWallet> {
  if (_wallet) return _wallet;
  const { createWallet } = await import('@galatabaker/sdk/wallet');
  _wallet = createWallet({ appName: 'GalataBaker' });
  // Wire external-disconnect propagation: when the user disconnects from
  // inside Temple/Kukai, Beacon fires ACTIVE_ACCOUNT_SET → store resets.
  if (!_unsubscribe) _unsubscribe = subscribeToActiveAccount(_wallet);
  return _wallet;
}

export function destroyWallet(): void {
  _unsubscribe?.();
  _unsubscribe = null;
  _wallet = null;
}
