# @galatabaker/indexer

Long-running TzKT cycle watcher. Keeps the API's Postgres in sync
with the chain so the web client can read fresh bakers, delegations,
and rewards without hitting TzKT on every request.

## Why a separate process

The indexer has fundamentally different requirements from the API:

- CPU-light but **never-ending** (no graceful exit on first request)
- Needs DB write access (mutates delegations, inserts rewards)
- Talks to **one** external service (TzKT), not the user
- Restart-safe via `IndexerState` table (`lastSeen` per resource)

The API is request/response; sharing a process means a slow sync
loop could starve user requests.

## Resources it syncs

| Resource      | Source endpoint                         | DB effect                              |
| ------------- | --------------------------------------- | -------------------------------------- |
| `bakers`      | `GET /v1/delegates?active=true`         | upsert by `pkh`                        |
| `rewards`     | `GET /v1/operations/rewards?level.ge=X` | insert new reward rows for Users       |
| `delegations` | `GET /v1/operations/delegations`        | promote `PENDING` → `CONFIRMED/FAILED` |

## Run

```bash
# local
cp .env.example .env  # then fill DATABASE_URL
pnpm install
pnpm dev              # tsx watch

# docker
docker compose up -d indexer
```

## Test

```bash
pnpm test
```

Tests use `vi.mock` against the TzKT client and Prisma — no real
network or DB needed.

## Env

| Var             | Default                         | Notes                                   |
| --------------- | ------------------------------- | --------------------------------------- | ---- | ---- | ----- |
| `TZKT_BASE_URL` | `https://api.bakingnet.tzkt.io` | switch to `https://api.tzkt.io` mainnet |
| `DATABASE_URL`  | (required)                      | same as apps/api                        |
| `INTERVAL_MS`   | `30000`                         | 30s per cycle                           |
| `BATCH_SIZE`    | `1000`                          | TzKT page size                          |
| `LOG_LEVEL`     | `info`                          | debug                                   | info | warn | error |

## Operational notes

- `IndexerState` rows store `lastSeen` per resource. First run starts
  from 0; restart resumes from where it left off.
- A reward for a wallet not registered with GalataBaker is silently
  skipped (no User to attach it to).
- A 503 from TzKT triggers exponential backoff per request; the loop
  itself is fault-tolerant — one failed resource doesn't stop the others.
- For testnet, default `INTERVAL_MS=30s` is fine. For mainnet, drop
  to `5s` to keep up with cycle progress.
