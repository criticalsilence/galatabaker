import type { Network, NetworkType } from '@airgap/beacon-types';
import { BeaconWallet } from '@taquito/beacon-wallet';

import { resolveConfig, type CreateClientOptions } from './client.js';

export interface CreateWalletOptions extends CreateClientOptions {
  /** Beacon pair ekranında görünecek uygulama adı. Default: 'GalataBaker'. */
  appName?: string;
  /** Beacon pair ekranında görünecek uygulama açıklaması. */
  appDescription?: string;
  /** Beacon pair ekranında görünecek dApp sitesi (referans için). */
  appUrl?: string;
}

export interface ActiveAccount {
  address: string;
  /** Public key (varsa). AccountInfo.publicKey? optional. */
  publicKey?: string;
}

/**
 * Tarayıcıya yüklenmiş Tezos cüzdan extension'ı var mı?
 *
 * İki aşamalı kontrol:
 * 1. Hızlı senkron kontrol — Temple, Kukai, Galleon, Beacon global'lerini
 *    `window` üzerinde ara. Cüzdan extension'ları bu objeleri content
 *    script inject aşamasında yaratır; varsa kesin tespittir.
 * 2. Yavaş asenkron kontrol — Beacon 4.x `getAvailableWallets()` postMessage
 *    protokolü. Bazı cüzdanlar (özellikle eski Temple) global inject etmez,
 *    sadece Beacon transport'una cevap verir. 2.5 sn timeout ile sınırla.
 *
 * Senkron kısayol Temple gibi yaygın extension'ları anında yakalar;
 * eski/yavaş extension'lar için asenkron fallback devreye girer.
 */
export async function isAnyWalletAvailable(timeoutMs = 2500): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. Sync: window global kontrolü (Temple >=2, Kukai, Galleon, Beacon-aware)
  const w = window as unknown as Record<string, unknown>;
  const syncDetected =
    typeof w.temple !== 'undefined' ||
    typeof w.kukai !== 'undefined' ||
    typeof w.galleon !== 'undefined' ||
    typeof w.beacon !== 'undefined';
  if (syncDetected) return true;

  // 2. Async: Beacon postMessage ile müsait cüzdanları sor
  const beacon = new BeaconWallet({ name: 'GalataBaker-detect' });
  try {
    const client = beacon.client as unknown as {
      getAvailableWallets: () => Promise<unknown[]>;
    };
    const wallets = await Promise.race([
      client.getAvailableWallets(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    return Array.isArray(wallets) && wallets.length > 0;
  } catch {
    return false;
  }
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
  /**
   * TZIP-32 plain message imzala (SIWW + future genel sign flow).
   *
   * Akış:
   *   1. Beacon `requestSignPayload({ signingType: 'message', payload, sourceAddress })`
   *   2. Cüzdan otomatik olarak payload'ı hex decode eder, 4-byte big-endian
   *      length prefix + raw pubkey (32 bytes) ekler, TZIP-32 watermark
   *      (`0x01 || "Tezos Signed Message:\n"`) prepend eder, blake2b-256
   *      hash'ler ve ed25519 private key ile imzalar.
   *   3. Sonuç: `edsig...` (base58).
   *
   * Server (apps/api/src/auth/auth.service.ts) aynı payload'ı yeniden kurup
   * aynı hash üzerinde imzayı doğrular — bu yüzden payload formatı
   * server ile birebir aynı olmalı; SDK bu yüzden `signingType: 'message'`
   * kullanıyor, raw payload göndermiyor.
   *
   * @throws No active account / wallet not connected
   * @throws User rejected signature
   */
  signMessage: (message: string) => Promise<{ signature: string; publicKey: string }>;
  /**
   * Beacon transport'unu kapat (localStorage temizlenmez).
   * Genellikle `destroy()` tercih edilir.
   */
  disconnectOnBeacon: () => Promise<void>;
  /**
   * Tüm Beacon state'ini temizle: accounts, peers, transport, localStorage.
   * "Disconnect" butonu bunu çağırır.
   */
  destroy: () => Promise<void>;
}

export function createWallet(options: CreateWalletOptions = {}): GalataBakerWallet {
  const config = resolveConfig(options.network);

  // Beacon 4.x'te `preferredNetwork` (NetworkType string) deprecated; yerine
  // `network: Network` objesi gerekiyor. CUSTOM network için name + rpcUrl
  // vermek wallet'ın (Temple, Kukai) doğru görüntüleme yapması için şart —
  // yoksa RPC'ye ulaşamayıp UNKNOWN_ERR dönebiliyor.
  const beaconNetwork: Network = {
    type: config.network as NetworkType,
    name: config.name,
    rpcUrl: config.rpcUrl,
  };

  const wallet = new BeaconWallet({
    name: options.appName ?? 'GalataBaker',
    description: options.appDescription ?? 'Tezos baking & delegation platform',
    appUrl: options.appUrl ?? 'https://galatabaker.app',
    // iconUrl: domain henüz kayıtlı olmadığı için şimdilik YOK. Temple ve
    // diğer cüzdanlar icon'u yükleyemezse UNKNOWN_ERR dönüyordu. Mainnet'e
    // geçerken gerçek icon URL'si (PNG/SVG) eklenecek.
    network: beaconNetwork,
  });

  /**
   * Beacon SDK çağrısını timeout ile sar. SDK 4.8.x bazı disconnect-path
   * çağrılarında (`removeAllPeers`, `transport` resolve vb.) asılı kalıp
   * hiç reject/resolve etmeyebiliyor — try/catch bunu yakalamıyor, ama
   * Promise.race ile timeout kazanırsa fonksiyon devam edebilir.
   *
   * Kaybeden promise arka planda çalışmaya devam eder; önemli olan bizim
   * kodumuzun takılı KALMAMAsı. UI yanıt süresi: toplam ≤ 3 × timeout.
   */
  async function safeBeaconCall<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    label: string,
  ): Promise<T | undefined> {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<undefined>((resolve) => {
      timeoutHandle = setTimeout(() => {
        // Sadece debug ortamında logla; production'da console çıktısı istemiyoruz
        if (typeof console !== 'undefined') {
          console.warn(`[GalataBaker] Beacon call "${label}" timed out after ${timeoutMs}ms`);
        }
        resolve(undefined);
      }, timeoutMs);
    });
    try {
      return await Promise.race([fn(), timeoutPromise]);
    } catch {
      // SDK çağrısı reject etti — sessizce yoksay
      return undefined;
    } finally {
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    }
  }

  return {
    getBeaconWallet: () => wallet,
    requestPermissions: async () => {
      // Beacon SDK 4.x: scopes opsiyonel; boş array vermek bazı cüzdanlarda
      // (Temple) kafa karışıklığı yaratabiliyor. Default davranış
      // [OPERATION_REQUEST, SIGN] — yani imzalama + operasyon izni istenir.
      await wallet.requestPermissions();
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
    /**
     * TZIP-32 plain message imzala. Beacon 4.x:
     *   - payload hex string (UTF-8 bytes)
     *   - signingType: 'message' (TZIP-32 plain — prepends watermark,
     *     4-byte msgLen, appends raw pubkey, blake2b-256, then ed25519)
     *   - sourceAddress gerekli değil ama açıkça geçmek multi-account
     *     cüzdanlarda (Kukai) doğru hesabı seçmeye yardımcı olur.
     *
     * Notlar:
     *   - signMessage'dan önce `getActiveAccount().publicKey` lazım —
     *     getActiveAccount ilk kez çağrıldığında `permissionInfo`
     *     response'undan doldurulur (requestPermissions sonrası).
     *   - publicKey yoksa Temple wallet lock'lu veya kullanıcı
     *     "permission" vermemiş olabilir.
     */
    signMessage: async (message: string) => {
      const account = await wallet.client.getActiveAccount();
      if (!account) throw new Error('No active Beacon account — connect first');
      if (!account.publicKey) {
        throw new Error('No public key on active account — wallet may be locked');
      }
      // Browser + Node 18+ TextEncoder mevcut; Beacon payload hex bekler.
      const bytes = new TextEncoder().encode(message);
      const hexPayload = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      const response = await wallet.client.requestSignPayload({
        // Beacon SDK's `SigningType` enum comes from @airgap/beacon-dapp
        // which has no .d.ts, so we cast the literal. Runtime value
        // matches SigningType.MESSAGE.
        signingType: 'message' as never,
        payload: hexPayload,
        sourceAddress: account.address,
      });
      return { signature: response.signature, publicKey: account.publicKey };
    },
    /**
     * Disconnect (sadece Beacon'ın kendi API'sini çağırır; localStorage
     * temizlenmez). disconnectOnBeacon tarafından kullanılır.
     */
    disconnectOnBeacon: async () => {
      await wallet.disconnect();
    },
    /**
     * Tam temizlik. Kullanıcı "Disconnect" tıkladığında çağrılır.
     *
     * 1. Beacon SDK çağrılarını TIMEOUT ile dene (removeAllAccounts /
     *    removeAllPeers / disconnect) — 4.8.x'te bunlar asılı kalabiliyor.
     * 2. localStorage anahtarlarını MANUEL temizle (kaybeden promise
     *    yüzünden SDK internal state'i kirli kalsa bile bizim için sorun
     *    değil — instance'ı store'da null yapacağız).
     * 3. Her halükârda en fazla ~3 saniyede döner.
     */
    destroy: async () => {
      // 1) Beacon SDK çağrıları (her biri max 1.5s — toplam 4.5s worst case)
      await safeBeaconCall(() => wallet.client.removeAllAccounts(), 1500, 'removeAllAccounts');
      await safeBeaconCall(() => wallet.client.removeAllPeers(), 1500, 'removeAllPeers');
      await safeBeaconCall(() => wallet.disconnect(), 1500, 'disconnect');

      // 2) localStorage anahtarlarını MANUEL temizle (her zaman çalışır)
      if (typeof window === 'undefined') return;
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (!k) continue;
          const lower = k.toLowerCase();
          if (
            lower.includes('beacon') ||
            lower.includes('airgap') ||
            lower.includes('dappclient') ||
            lower.includes('matrix') /* Beacon matrix transport */
          ) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      } catch {
        // localStorage unavailable (private mode / quota) — yoksay
      }
    },
  };
}
