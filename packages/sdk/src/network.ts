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
 * Bakingnet — baker testnet'i (Teztnets, Haziran 2026).
 *
 * - RPC: https://rpc.bakingnet.teztnets.com
 * - Chain ID: NetXvNVUNbWHxGt (Bakingnet protocol genesis hash)
 * - TzKT: https://api.bakingnet.tzkt.io/v1
 * - Faucet: https://faucet.bakingnet.teztnets.com
 * - Activated: 2026-04-08
 *
 * Teztnets "baker testnet'i" — mainnet'ten ~1 hafta önce protokol geçişi yapar,
 * production-like baking senaryoları için ideal. Dapp geliştirme için Shadownet
 * önerilir ama biz baking platformu olduğumuz için buradayız.
 *
 * Doğrulama: https://teztnets.com/teztnets.json (canlı config)
 */
export const BAKINGNET_TESTNET: TezosNetworkConfig = {
  name: 'Bakingnet',
  rpcUrl: 'https://rpc.bakingnet.teztnets.com',
  network: NetworkType.CUSTOM,
  chainId: 'NetXvNVUNbWHxGt',
  tzktUrl: 'https://api.bakingnet.tzkt.io/v1',
  explorerUrl: 'https://bakingnet.tzkt.io',
  faucetUrl: 'https://faucet.bakingnet.teztnets.com',
};

/**
 * Shadownet — dapp geliştirme testnet'i (Teztnets, Haziran 2026).
 *
 * - RPC: https://rpc.shadownet.teztnets.com
 * - Chain ID: NetXsqzbfFenSTS (Shadownet protocol genesis hash)
 * - TzKT: https://api.shadownet.tzkt.io/v1
 * - Faucet: https://faucet.shadownet.teztnets.com
 * - Activated: 2025-08-07
 *
 * Mainnet'i "shadow" eder; dapp geliştirme için önerilen uzun ömürlü testnet.
 * Bizim MVP'mizde secondary network olarak kullanılabilir (örn. UI test).
 */
export const SHADOWNET_TESTNET: TezosNetworkConfig = {
  name: 'Shadownet',
  rpcUrl: 'https://rpc.shadownet.teztnets.com',
  network: NetworkType.CUSTOM,
  chainId: 'NetXsqzbfFenSTS',
  tzktUrl: 'https://api.shadownet.tzkt.io/v1',
  explorerUrl: 'https://shadownet.tzkt.io',
  faucetUrl: 'https://faucet.shadownet.teztnets.com',
};

export const NETWORKS = {
  bakingnet: BAKINGNET_TESTNET,
  shadownet: SHADOWNET_TESTNET,
} as const;

export type NetworkKey = keyof typeof NETWORKS;
