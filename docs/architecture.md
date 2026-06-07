# Mimari

## Genel Bakış

GalataBaker, kullanıcının kendi cüzdanı (Temple, Kukai, Beacon) üzerinden Tezos ağında baking/staking yapmasını sağlayan bir platformdur. Private key hiçbir zaman sunucuya veya client-side store'a dokunmaz.

## Katmanlar

```
┌────────────────────────────────────────────────────────────┐
│  Kullanıcı (Browser)                                       │
│  ├─ Next.js Web (apps/web)                                 │
│  └─ Cüzdan Extension (Temple, Kukai, Beacon)               │
└────────────────────────────────────────────────────────────┘
            │
            │ HTTPS / WSS
            ▼
┌────────────────────────────────────────────────────────────┐
│  Cloudflare (proxy + SSL + DDoS)                           │
└────────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────┐
│  Hetzner VPS                                               │
│  ├─ Nginx (reverse proxy)                                  │
│  ├─ apps/web (Next.js, port 3000)                          │
│  ├─ apps/api (NestJS, port 3001)                           │
│  ├─ apps/indexer (BullMQ worker)                           │
│  ├─ octez-node (rolling, port 8732 internal)               │
│  ├─ octez-baker + signer (opsiyonel MVP)                   │
│  ├─ postgres (16)                                          │
│  └─ redis (7)                                              │
└────────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────┐
│  External                                                  │
│  ├─ Tezos Network (Ushuaia testnet → mainnet)              │
│  ├─ tzkt.io (indexer)                                      │
│  ├─ Resend (e-posta)                                       │
│  └─ Telegram Bot API                                       │
└────────────────────────────────────────────────────────────┘
```

## Veri Akışı (Delegate)

```
1. User → apps/web: "Delegate 100 XTZ" tıklar
2. apps/web: taquito ile dry-run simülasyon
3. apps/web → User Wallet: sign popup
4. User Wallet: imzalar, döner ops hash
5. apps/web: ops broadcast (Tezos RPC)
6. Tezos Network: op'i işler, block'a ekler
7. apps/web: ops hash'i apps/api'ye log olarak gönderir
8. apps/indexer: tzkt'den yeni block'ları izler
9. apps/indexer: ilgili PKH için yeni op'i tespit eder
10. apps/indexer: DB'ye delegate event yazar
11. apps/api: kullanıcıya notification gönderir (e-posta + Telegram)
```

## Veri Akışı (Reward)

```
1. apps/indexer: her 30s tzkt'den son cycle'ı kontrol eder
2. Yeni cycle tamamlandı → ilgili PKH'lar için reward'ları çeker
3. apps/indexer → DB: reward record yazar
4. apps/api: kullanıcıya "yeni ödül" bildirimi gönderir
5. User → apps/web: "Claim" tıklar
6. apps/web: transfer op'i oluşturur, sign için wallet'a gönderir
7. Sonuç: reward cüzdana transfer edilir
```

## Tech Stack

Detaylı liste için `~/.hermes/plans/2026-06-07_081452-tezos-ushuaia-staking-platform-step1.md` dosyasına bak.

## Modüller

İleride doldurulacak.

## DB Şeması

İleride doldurulacak (Prisma şeması stabil olduktan sonra).
