import { NetworkType } from '@airgap/beacon-types';

/**
 * Tezos ağ yapılandırması.
 *
 * Her network için:
 * - rpcUrl: Tezos node RPC endpoint (Taquito bunu kullanır)
 * - network: Beacon'ın eşleştirme (pair) akışı için kullandığı ağ tanımlayıcı
 * - chainId: Ağ genesis hash'i (NetworkType.CUSTOM için zorunlu)
 * - tzktUrl: TzKT indexer API base URL
 * - explorerUrl: Block explorer base URL (UI'da link göstermek için)
 * - faucetUrl: Testnet tez (TZ) alabileceğiniz faucet (sadece testnet)
 * - name: UI'da gösterilecek okunabilir isim
 */
export interface TezosNetworkConfig {
  name: string;
  rpcUrl: string;
  network: NetworkType;
  chainId: string;
  tzktUrl: string;
  explorerUrl: string;
  faucetUrl?: string;
}

/**
 * Teztnets.com Ushuaia testnet (Haziran 2026 varsayılan test ağı).
 *
 * - RPC: https://rpc.ushuaia.teztnets.com
 * - Chain ID: NetXdQprcVkpaWU (Ushuaia'nın protocol genesis hash'i)
 * - TzKT: https://api.ushuaia.teztnets.com
 * - Faucet: https://faucet.ushuaia.teztnets.com
 *
 * Not: chainId değerleri teztnets.com'daki güncel ağa göre değişebilir.
 *      teztnets.com üzerinden doğrulanmalıdır.
 */
export const USHUAIA_TESTNET: TezosNetworkConfig = {
  name: 'Ushuaia',
  rpcUrl: 'https://rpc.ushuaia.teztnets.com',
  network: NetworkType.CUSTOM,
  chainId: 'NetXdQprcVkpaWU',
  tzktUrl: 'https://api.ushuaia.teztnets.com',
  explorerUrl: 'https://ushuaia.teztnets.com',
  faucetUrl: 'https://faucet.ushuaia.teztnets.com',
};

export const NETWORKS = {
  ushuaia: USHUAIA_TESTNET,
} as const;

export type NetworkKey = keyof typeof NETWORKS;
