'use client';

import { createWallet, type GalataBakerWallet, type ActiveAccount } from '@galatabaker/sdk/wallet';
import { create } from 'zustand';

interface WalletState {
  wallet: GalataBakerWallet | null;
  address: string | null;
  publicKey: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

/**
 * Cüzdan bağlantı durumunu tutan Zustand store.
 *
 * BeaconWallet yalnızca browser'da yaşar (localStorage + WebSocket), bu yüzden
 * 'use client' zorunludur. SSR sırasında bu modül yüklenmez.
 *
 * Güvenlik: Private key bu store'da veya component state'inde SAKLANMAZ.
 * Beacon wallet pair'lenir ve imzalama doğrudan kullanıcının cüzdanında yapılır.
 */
export const useWallet = create<WalletState>((set, get) => ({
  wallet: null,
  address: null,
  publicKey: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  connect: async () => {
    set({ isConnecting: true, error: null });
    try {
      const wallet = get().wallet ?? createWallet({ appName: 'GalataBaker' });
      await wallet.requestPermissions();
      const account: ActiveAccount | null = await wallet.getActiveAccount();
      if (!account) throw new Error('No account returned from wallet');
      set({
        wallet,
        address: account.address,
        publicKey: account.publicKey ?? null,
        isConnected: true,
        isConnecting: false,
      });
    } catch (e) {
      set({
        isConnecting: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
  disconnect: async () => {
    const w = get().wallet;
    if (w) {
      try {
        await w.disconnect();
      } catch {
        /* ignore disconnect errors */
      }
    }
    set({ wallet: null, address: null, publicKey: null, isConnected: false });
  },
}));
