# @galatabaker/sdk

Tezos logic SDK — Taquito 17 + Beacon SDK 4 + TzKT + BLS12-381.

## Quickstart

```ts
import {
  USHUAIA_TESTNET,
  createTezosClient,
  createWallet,
  createTzktClient,
} from '@galatabaker/sdk';

// 1. RPC client (Ushuaia testnet)
const client = createTezosClient();
console.log('RPC:', client.getRpcUrl());

// 2. Beacon wallet (Temple / Kukai / Galleon)
const wallet = createWallet({ appName: 'GalataBaker' });
await wallet.requestPermissions(); // opens pairing popup
const address = await wallet.getAddress();
await wallet.disconnect();

// 3. TzKT indexer
const tzkt = createTzktClient();
const head = await tzkt.getHead();
console.log('Block level:', head.level);
```

## Network Config

Default `ushuaia` testnet (Haziran 2026). Tüm config:

```ts
import { USHUAIA_TESTNET, NETWORKS } from '@galatabaker/sdk';

console.log(USHUAIA_TESTNET.rpcUrl); // https://rpc.ushuaia.teztnets.com
console.log(USHUAIA_TESTNET.tzktUrl); // https://api.ushuaia.teztnets.com
console.log(USHUAIA_TESTNET.faucetUrl); // https://faucet.ushuaia.teztnets.com
```

## BLS12-381 (tz4 baker adresleri)

```ts
import { generateBlsKeyPair, signBls, verifyBls } from '@galatabaker/sdk';

const kp = generateBlsKeyPair(); // testnet only
const sig = signBls(kp.secretKey, new Uint8Array([1, 2, 3]));
verifyBls(kp.publicKey, new Uint8Array([1, 2, 3]), sig); // → true
```

## Güvenlik Notları

- **Hiçbir private key bu SDK'da saklanmaz.** Tüm imzalama kullanıcı
  cüzdanında (Beacon) veya remote signer'da gerçekleşir.
- BLS anahtarları `generateBlsKeyPair()` sadece testnet/fixture içindir.
  Mainnet baker anahtarları remote signer (SIGNATORY, TZ4REMOTE) ile yönetilir.
- `disconnect()` hem Beacon bağlantısını hem de pair peer'ı temizler
  (uygulama state'ini sıfırlamak için).

## Test

```bash
pnpm --filter @galatabaker/sdk test
```

Tüm testler Vitest ile yazılmıştır; Beacon RPC mock'lanır, gerçek
mainnet çağrısı yapılmaz.
