'use client';

/**
 * GalataBaker wallet feature — Zustand store, single source of truth
 * for wallet UI state.
 *
 * State machine (mirrors Kolibri src/entities/wallet/model/model.ts):
 *
 *   idle ──connect()──▶ connecting ──┬──▶ connected
 *                                   └──▶ error ──connect()──▶ connecting
 *   idle ──restore()──▶ restoring ──┬──▶ connected
 *                                  └──▶ idle
 *
 * `connected → idle` happens via either disconnect() (user clicked
 * our button) or handleExternalDisconnect() (Beacon ACTIVE_ACCOUNT_SET
 * fired because the user disconnected in the wallet itself).
 *
 * Persistence: Beacon SDK's localStorage is the source of truth for
 * "is there a paired wallet?". sessionStorage's `galatabaker:disconnected`
 * flag suppresses auto-restore when the user explicitly disconnected
 * this session (mirrors Kolibri's sessionCheckDone behaviour).
 *
 * Restore timeout: 5s (Kolibri pattern). Beacon's getActiveAccount can
 * hang on a stale matrix transport; if it doesn't resolve in 5s we
 * give up and leave the UI in `idle` so the user can still click
 * "Connect" cleanly.
 */

import type { GalataBakerWallet } from '@galatabaker/sdk/wallet';
import { create } from 'zustand';

import { destroyWallet, getOrCreateWallet } from './beacon';

import { extractErrorMessage } from '@/lib/error';

const DISCONNECT_FLAG_KEY = 'galatabaker:disconnected';
const RESTORE_TIMEOUT_MS = 5_000;

export type WalletUiState = 'idle' | 'restoring' | 'connecting' | 'connected' | 'error';

interface WalletState {
  state: WalletUiState;
  address: string | null;
  publicKey: string | null;
  error: string | null;

  restore: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  /** Called by the ACTIVE_ACCOUNT_SET subscription. */
  handleExternalDisconnect: () => void;
}

// sessionStorage helpers — wrap in try/catch so SSR / private mode
// doesn't blow up the module.
function sessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function sessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private mode / quota — ignore */
  }
}
function sessionDel(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const useWallet = create<WalletState>((set) => ({
  state: 'idle',
  address: null,
  publicKey: null,
  error: null,

  restore: async () => {
    if (sessionGet(DISCONNECT_FLAG_KEY)) return;
    set({ state: 'restoring', error: null });

    // Lazy-create the wallet with a 5s ceiling. Kolibri uses an
    // external setTimeout; we inline Promise.race for fewer moving parts.
    const wallet = await Promise.race<GalataBakerWallet | null>([
      getOrCreateWallet(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), RESTORE_TIMEOUT_MS)),
    ]);
    if (!wallet) {
      set({ state: 'idle' });
      return;
    }
    const account = await wallet.getActiveAccount();
    if (account) {
      set({
        state: 'connected',
        address: account.address,
        publicKey: account.publicKey ?? null,
      });
    } else {
      set({ state: 'idle' });
    }
  },

  connect: async () => {
    set({ state: 'connecting', error: null });
    try {
      const wallet = await getOrCreateWallet();
      await wallet.requestPermissions();
      const account = await wallet.getActiveAccount();
      if (!account) throw new Error('No account returned from wallet');
      sessionDel(DISCONNECT_FLAG_KEY);
      set({
        state: 'connected',
        address: account.address,
        publicKey: account.publicKey ?? null,
      });
    } catch (e) {
      set({ state: 'error', error: extractErrorMessage(e) });
    }
  },

  disconnect: async () => {
    const wallet = await getOrCreateWallet().catch(() => null);
    if (wallet) {
      try {
        await wallet.destroy();
      } catch {
        /* SDK may hang on disconnect; UI must still reset */
      }
    }
    sessionSet(DISCONNECT_FLAG_KEY, '1');
    destroyWallet();
    set({ state: 'idle', address: null, publicKey: null, error: null });
  },

  handleExternalDisconnect: () => {
    sessionSet(DISCONNECT_FLAG_KEY, '1');
    destroyWallet();
    set({ state: 'idle', address: null, publicKey: null, error: null });
  },
}));
