'use client';

import { createWallet, type GalataBakerWallet, type ActiveAccount } from '@galatabaker/sdk/wallet';
import { create } from 'zustand';

import { extractErrorMessage } from '@/lib/error';

const DISCONNECT_FLAG_KEY = 'galatabaker:disconnected';

interface WalletState {
  wallet: GalataBakerWallet | null;
  address: string | null;
  publicKey: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isRestoring: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  /**
   * Mount zamanında çağrılır: Beacon SDK'nın localStorage'ında kayıtlı
   * aktif hesap var mı kontrol eder, varsa store'u senkronize eder.
   * Kullanıcı bu oturumda bilinçli olarak disconnect etmişse atlar
   * (sessionStorage flag'i ile).
   */
  restoreSession: () => Promise<void>;
}

/**
 * Cüzdan bağlantı durumunu tutan Zustand store.
 *
 * BeaconWallet yalnızca browser'da yaşar (localStorage + WebSocket), bu yüzden
 * 'use client' zorunludur. SSR sırasında bu modül yüklenmez.
 *
 * Persistence stratejisi:
 * - Beacon SDK localStorage → bağlantı durumunun kaynağı (active account)
 * - sessionStorage `galatabaker:disconnected` → kullanıcı disconnect
 *   ettiyse bu oturum boyunca otomatik restore'u engeller
 * - Modül-içi Zustand state → aynı oturumdaki navigasyonlarda korunur
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
  isRestoring: false,
  error: null,

  restoreSession: async () => {
    // sessionStorage flag: kullanıcı bilinçli olarak disconnect ettiyse atla.
    // window/sessionStorage kontrolü YAPMIYORUZ — try/catch SSR ve test
    // ortamlarındaki undefined referansları zaten yutuyor.
    let skipRestore = false;
    try {
      if (sessionStorage.getItem(DISCONNECT_FLAG_KEY)) {
        skipRestore = true;
      }
    } catch {
      // sessionStorage unavailable (SSR / private mode / Node test)
    }
    if (skipRestore) return;

    set({ isRestoring: true });
    try {
      const wallet = get().wallet ?? createWallet({ appName: 'GalataBaker' });
      const account: ActiveAccount | null = await wallet.getActiveAccount();
      if (account) {
        set({
          wallet,
          address: account.address,
          publicKey: account.publicKey ?? null,
          isConnected: true,
        });
      } else {
        // Hesap yoksa sadece wallet instance'ı sakla (sonraki connect için)
        set({ wallet });
      }
    } catch {
      // Beacon SDK mevcut değil veya hata — sessizce yoksay
    } finally {
      set({ isRestoring: false });
    }
  },

  connect: async () => {
    set({ isConnecting: true, error: null });
    try {
      const wallet = get().wallet ?? createWallet({ appName: 'GalataBaker' });
      await wallet.requestPermissions();
      const account: ActiveAccount | null = await wallet.getActiveAccount();
      if (!account) throw new Error('No account returned from wallet');
      // Başarılı bağlantı → disconnect flag'ini temizle
      try {
        sessionStorage.removeItem(DISCONNECT_FLAG_KEY);
      } catch {
        // yoksay
      }
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
        // Beacon SDK bazen plain object fırlatıyor; extractErrorMessage
        // "[object Object]" yerine description/title/message çıkarıyor.
        error: extractErrorMessage(e),
      });
    }
  },

  disconnect: async () => {
    const w = get().wallet;
    if (w) {
      try {
        // destroy() hem Beacon'ı hem de localStorage'ı temizler
        await w.destroy();
      } catch {
        // Yine de store'u temizle — UI kilitlenmesin
      }
    }
    // Bu oturum boyunca otomatik restore'u engelle
    try {
      sessionStorage.setItem(DISCONNECT_FLAG_KEY, '1');
    } catch {
      // yoksay
    }
    set({ wallet: null, address: null, publicKey: null, isConnected: false });
  },
}));
