import type { NetworkType } from '@airgap/beacon-types';
import { BeaconWallet } from '@taquito/beacon-wallet';

import { resolveConfig, type CreateClientOptions } from './client.js';

export interface CreateWalletOptions extends CreateClientOptions {
  /** Beacon pair ekranında görünecek uygulama adı. Default: 'GalataBaker'. */
  appName?: string;
  /** Beacon pair ekranında görünecek uygulama ikonu (https URL). */
  appIcon?: string;
}

export interface ActiveAccount {
  address: string;
  /** Public key (varsa). AccountInfo.publicKey? optional. */
  publicKey?: string;
}

/**
 * GalataBakerWallet — BeaconWallet üzerine ince bir sarmalayıcı.
 *
 * - Ağ zaten BeaconWallet constructor'ında preferredNetwork ile seçiliyor;
 *   requestPermissions yalnızca scope listesi alıyor (4.x API).
 * - Tüm imzalama kullanıcı cüzdanında yapılır (Temple/Kukai/Galleon).
 *   Private key bu SDK'da SAKLANMAZ.
 */
export interface GalataBakerWallet {
  getBeaconWallet: () => BeaconWallet;
  requestPermissions: () => Promise<void>;
  getAddress: () => Promise<string>;
  getActiveAccount: () => Promise<ActiveAccount | null>;
  disconnect: () => Promise<void>;
}

export function createWallet(options: CreateWalletOptions = {}): GalataBakerWallet {
  const config = resolveConfig(options.network);

  const wallet = new BeaconWallet({
    name: options.appName ?? 'GalataBaker',
    iconUrl: options.appIcon ?? 'https://galatabaker.app/icon.png',
    preferredNetwork: config.network as NetworkType,
  });

  return {
    getBeaconWallet: () => wallet,
    requestPermissions: async () => {
      // Beacon SDK 4.x: requestPermissions({ scopes: [] })
      // Ağ zaten preferredNetwork ile seçildi; burada sadece izin isteniyor.
      await wallet.requestPermissions({ scopes: [] });
    },
    getActiveAccount: async () => {
      const account = await wallet.client.getActiveAccount();
      if (!account) return null;
      return { address: account.address, publicKey: account.publicKey };
    },
    getAddress: async () => {
      const account = await wallet.client.getActiveAccount();
      if (!account) throw new Error('No active Beacon account');
      return account.address;
    },
    disconnect: async () => {
      await wallet.disconnect();
      await wallet.client.removeAllAccounts();
      await wallet.client.removeAllPeers();
    },
  };
}
