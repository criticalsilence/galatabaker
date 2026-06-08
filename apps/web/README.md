# @galatabaker/web

Next.js 14 dashboard — Ushuaia testnet MVP.

## Pages

| Route        | Purpose                                        |
| ------------ | ---------------------------------------------- |
| `/`          | Landing + wallet connect                       |
| `/dashboard` | Network status, block height, links to actions |
| `/delegate`  | (Adım 5) Delegation flow with baker picker     |
| `/rewards`   | (Adım 5) Read-only reward history              |

## Architecture

- **App Router** + server components for read-only data
- **Client components** only where browser-only APIs are needed (Beacon wallet, Zustand)
- **`@galatabaker/sdk`** for all Tezos logic (RPC, TzKT, Beacon, BLS)
- **Tailwind CSS** + shadcn-style CSS variables
- **Zustand** for client state (wallet)
- **TypeScript strict**

## Security

- Server components hold a long-lived `TezosToolkit` instance (no signer)
- Client wallet integration via Beacon SDK → user's wallet signs, not us
- No private keys ever in this app

## Dev

```bash
pnpm --filter @galatabaker/web dev      # http://localhost:3000
pnpm --filter @galatabaker/web build    # production build
pnpm --filter @galatabaker/web test     # vitest
```
