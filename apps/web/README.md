# @galatabaker/web

Next.js 15 dashboard — Bakingnet testnet MVP.

## Pages

| Route | Purpose                  |
| ----- | ------------------------ |
| `/`   | Landing + wallet connect |

Other pages (`/dashboard`, `/delegate`, `/rewards`) are intentionally
absent in MVP — they will be added in Task 12 (web↔api integration)
when the API endpoints are wired up. The landing page is the only
piece that needs to work end-to-end right now (SIWW + wallet connect).

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
pnpm --filter @galatabaker/web typecheck
```
