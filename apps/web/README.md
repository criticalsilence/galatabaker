# @galatabaker/web

Next.js 15 dashboard — Bakingnet testnet MVP.

## Pages

| Route        | Type            | Purpose                                            |
| ------------ | --------------- | -------------------------------------------------- |
| `/`          | client          | Landing + wallet connect + SIWW                    |
| `/dashboard` | server + client | Network health (SSR) + top 5 bakers (CSR) + status |
| `/delegate`  | client          | Baker list + manual delegation instructions (MVP)  |
| `/rewards`   | client          | Cycle breakdown + reward entries (auth required)   |
| `/sign-in`   | client          | SIWW flow entry point + post-sign-in card          |

## Stack

- **Next.js 15.5** + **React 19** + **TypeScript strict** (noUncheckedIndexedAccess)
- **Zustand 5** for client state (wallet, JWT)
- **TanStack Query 5** for server-state caching
- **Beacon SDK 4** for wallet integration (lazy: only loaded on first Connect)
- **Tailwind CSS** with shadcn-style CSS variables
- **`@galatabaker/sdk`** for all Tezos primitives (signMessage, RPC, TzKT)

## Architecture

```
src/
  app/
    layout.tsx                # root layout + QueryProvider
    page.tsx                  # /  (landing)
    dashboard/                # server-side /api/health + client bakers
    delegate/                 # Suspense + useSearchParams
    rewards/                  # auth-gated, reads auth-store
    sign-in/                  # WalletPanel host
  features/
    api/
      health.ts               # wire shape
      hooks/
        use-bakers.ts         # useBakers, useBaker
        use-user.ts           # useUser, mutations
        use-delegations.ts    # useDelegations, useCreateDelegation
        use-rewards.ts        # useRewards, useClaimReward
        use-notifications.ts  # useNotifications, useUnreadCount
    connect-wallet/
      beacon.ts               # lazy factory + singleton
      model.ts                # 5-state Zustand store
      subscribe.ts            # ACTIVE_ACCOUNT_SET wiring
      ui/
        WalletPanel.tsx       # orchestrator
        ConnectButton.tsx     # mount -> restore -> CTA
        WalletInfo.tsx        # connected: address + SignIn + Disconnect
        SignInButton.tsx      # signIn / signOut toggle
  lib/
    api-config.ts             # NEXT_PUBLIC_API_URL
    api-client.ts             # fetch wrapper + JWT auto-inject
    auth.ts                   # SIWW: challenge -> signMessage -> verify
    auth-store.ts             # Zustand + persist (localStorage)
    error.ts, format.ts       # small helpers
  scripts/
    smoke.mjs                 # smoke test (5 routes 200)
```

## SIWW (Sign-In With Wallet)

1. `GET  /api/auth/challenge` → `{ nonce, message, expiresAt }`
2. `wallet.signMessage(message)` → `{ signature, publicKey }` (TZIP-32 plain)
3. `POST /api/auth/verify` → `{ accessToken, walletPkh }`
4. `Authorization: Bearer ***` on all authed calls (`useUser`, `useNotifications`)

JWT lives in `localStorage` (Zustand `persist`). Same-site XSS exposure;
CSRF not a concern (token, not cookie). Mainnet: migrate to `httpOnly` cookie.

## Security

- **Wallet connect only** — no private keys in this app, ever
- Server components hold a long-lived `TezosToolkit` (no signer)
- Beacon `requestPermissions` is the only auth path
- Auth-gated routes check `auth-store.isAuthenticated()` client-side;
  the server asserts the same on every authed request

## Dev

```bash
pnpm --filter @galatabaker/web dev        # http://localhost:3000
pnpm --filter @galatabaker/web build      # production build
pnpm --filter @galatabaker/web start      # production server
pnpm --filter @galatabaker/web typecheck
pnpm --filter @galatabaker/web lint

node scripts/smoke.mjs                    # 5 routes 200
```

Bundle sizes (production):

| Route        | Size   | First Load JS |
| ------------ | ------ | ------------- |
| `/`          | 1.4 kB | 110 kB        |
| `/dashboard` | 2.8 kB | 120 kB        |
| `/delegate`  | 3.6 kB | 118 kB        |
| `/rewards`   | 1.5 kB | 119 kB        |
| `/sign-in`   | 1.9 kB | 111 kB        |

Shared first-load JS: **102 kB**. The Beacon SDK + Taquito
(~150 kB) are not in the initial bundle of any route — they
load on first Connect.
