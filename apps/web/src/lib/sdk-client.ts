import { createTezosClient } from '@galatabaker/sdk/client';
import {
  USHUAIA_TESTNET,
  type TezosNetworkConfig,
  type NetworkKey,
} from '@galatabaker/sdk/network';
import { createTzktClient } from '@galatabaker/sdk/tzkt';

/**
 * Server-side singleton wrapper.
 *
 * Next.js server component'lerde ve route handler'larda aynı client'ı
 * paylaşırız. Client'lar signer içermez (yalnızca RPC + TzKT), bu yüzden
 * private key taşıma riski yoktur.
 *
 * Browser'da kullanılacak wallet/signer kodu bu dosyada yer almaz; o
 * kullanım için doğrudan @galatabaker/sdk import edin.
 */

let _tezos: ReturnType<typeof createTezosClient> | null = null;
let _tzkt: ReturnType<typeof createTzktClient> | null = null;

export function getTezosClient(network?: NetworkKey | TezosNetworkConfig) {
  if (!network && !_tezos) {
    _tezos = createTezosClient();
  }
  return network ? createTezosClient({ network }) : _tezos!;
}

export function getTzktClient(network?: NetworkKey | TezosNetworkConfig) {
  if (!network && !_tzkt) {
    _tzkt = createTzktClient();
  }
  return network ? createTzktClient({ network }) : _tzkt!;
}

export { USHUAIA_TESTNET };
