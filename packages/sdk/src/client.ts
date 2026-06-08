import { TezosToolkit } from '@taquito/taquito';

import {
  BAKINGNET_TESTNET,
  NETWORKS,
  type TezosNetworkConfig,
  type NetworkKey,
} from './network.js';

export interface CreateClientOptions {
  /** Network seçimi. Key ('bakingnet') veya özel config objesi. Default: 'bakingnet'. */
  network?: NetworkKey | TezosNetworkConfig;
  /** Network.rpcUrl'i override eder. Farklı bir node/relay kullanmak için. */
  overrideRpcUrl?: string;
}

/**
 * Verilen seçeneklerle bir Tezos RPC client döndürür.
 *
 * - network verilmezse Bakingnet testnet kullanılır (baker platformu için)
 * - string ise NETWORKS sözlüğünden çekilir
 * - obje ise doğrudan kullanılır
 * - overrideRpcUrl verilirse onu kullanır (network.rpcUrl yerine)
 *
 * Güvenlik: Client wallet/signer içermez. Transaction imzalamak için
 * createWallet() veya createInMemorySigner() ayrıca bağlanmalıdır.
 */
export function createTezosClient(options: CreateClientOptions = {}): TezosToolkit {
  const config = resolveConfig(options.network);
  const rpcUrl = options.overrideRpcUrl ?? config.rpcUrl;
  return new TezosToolkit(rpcUrl);
}

/**
 * Network parametresini her zaman bir TezosNetworkConfig objesine çevirir.
 * - undefined → default (Bakingnet)
 * - string → NETWORKS sözlüğünden
 * - obje → aynen
 *
 * Bilinmeyen key'de açık hata fırlatır (sessiz fallback yok).
 */
export function resolveConfig(network?: NetworkKey | TezosNetworkConfig): TezosNetworkConfig {
  if (network === undefined) return BAKINGNET_TESTNET;
  if (typeof network === 'string') {
    const cfg = NETWORKS[network];
    if (!cfg) throw new Error(`Unknown network: ${String(network)}`);
    return cfg;
  }
  return network;
}
