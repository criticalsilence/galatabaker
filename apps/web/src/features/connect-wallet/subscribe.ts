'use client';

import type { GalataBakerWallet } from '@galatabaker/sdk/wallet';

import { useWallet } from './model';

const ACTIVE_ACCOUNT_SET = 'active_account_set' as const;

/**
 * Subscribe to Beacon's ACTIVE_ACCOUNT_SET event so external wallet
 * disconnects (user clicks "Disconnect" inside Temple/Kukai) propagate
 * to our local store.
 *
 * The underlying Beacon subscription lives inside the SDK; we don't
 * retain a handle because `destroyWallet()` drops the wallet instance
 * and all its listeners get GC'd along with it.
 */
export function subscribeToActiveAccount(wallet: GalataBakerWallet): () => void {
  const beacon = wallet.getBeaconWallet();
  const handler = () => {
    useWallet.getState().handleExternalDisconnect();
  };
  // Cast: Beacon SDK's subscribeToEvent is loosely typed for the
  // event-name arg; the runtime value matches BeaconEvent.ACTIVE_ACCOUNT_SET.
  beacon.client.subscribeToEvent(ACTIVE_ACCOUNT_SET as never, handler as never);
  return () => {
    /* noop — see destroyWallet() in beacon.ts */
  };
}
