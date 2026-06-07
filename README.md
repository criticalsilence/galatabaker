# GalataBaker

> Tezos baking & staking platform — wallet connect, bildirimler, esnek ödül dağıtımı.

**Status:** 🚧 MVP in development — Ushuaia testnet first, mainnet 1-2 ay sonra.

## Stack

- **Frontend:** Next.js 14 + TypeScript 5 + Tailwind 3
- **Backend:** NestJS 10 + Prisma 5 + PostgreSQL 16
- **Blockchain:** Octez 24+ (Tezos node), Taquito 17, Beacon SDK 4
- **Indexer:** tzkt.io API + custom BullMQ workers
- **Notifications:** Resend (e-posta) + Telegraf (Telegram)
- **Hosting:** Hetzner Cloud + Cloudflare (DNS/SSL)

## Quick Start (Development)

```bash
# Node 20 + pnpm 9 gerekli
nvm use 20
corepack enable

# Install
pnpm install

# Dev stack
docker compose up -d
```

## Repo Yapısı

```
apps/
  web/         # Next.js 14 frontend
  api/         # NestJS 10 backend
  indexer/     # Cycle/reward watcher
packages/
  sdk/         # @galatabaker/sdk — Tezos logic
  types/       # @galatabaker/types
  ui/          # @galatabaker/ui
  config/      # @galatabaker/config
infra/
  docker/      # Dockerfile'lar
  compose/     # compose dosyaları
docs/          # Mimari, security, runbook, API
```

## Lisans

MIT — see [LICENSE](./LICENSE).

## Güvenlik

Güvenlik açıkları için [SECURITY.md](./SECURITY.md) oku.
