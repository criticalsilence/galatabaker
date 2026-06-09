/**
 * GalataBaker API — Seed: 5 testnet baker.
 *
 * Neden seed?
 *   MVP'de baker self-registration yok (Adım 6+). Platformu test edebilmek
 *   için gerçekçi 5 baker'a ihtiyacımız var. Bunlar:
 *
 *   1. Galata Baker (kendi baker'ımız, %5 fee)
 *   2. Stakefish (gerçek public baker, profesyonel)
 *   3. Tezos Team (foundation baker)
 *   4. Everstake (büyük validator)
 *   5. P2P Validator (alternatif)
 *
 *   Testnet pkh'ler — mainnet adresleri DEĞİL. Bunlar sadece DB seed
 *   olarak kullanılıyor, gerçek fund edilmiş hesaplar değil.
 *
 * Kullanım:  pnpm --filter @galatabaker/api prisma:seed
 * Idempotent: aynı pkh varsa skip eder, üzerine yazmaz.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedBaker {
  pkh: string;
  alias: string;
  status: string;
  fee: number;
  capacity: bigint;
  totalStake: bigint;
  delegatedBalance: bigint;
  blocksBaked: number;
  missedBlocks: number;
}

// Base58 alphabet — a-k, m-z, A-H, J-N, P-Z, 1-9. 0/O/I/l yok.
// Seed pkh'lar API validation'dan geçebilsin diye sanitizer.
const B58 = /[^a-km-zA-HJ-NP-Z1-9]/g;
function safePkh(s: string): string {
  return s.replace(B58, '1'); // '1' base58-safe padding
}

const SEED_BAKERS: SeedBaker[] = [
  {
    // Galata Baker — kendi markamız
    pkh: safePkh('tz1GalataBaker').padEnd(36, '1').slice(0, 36), // 36 char, base58-safe
    alias: 'Galata Baker',
    status: 'active',
    fee: 0.05,
    capacity: 60_000_000_000_000n, // 60k tez
    totalStake: 45_000_000_000_000n,
    delegatedBalance: 35_000_000_000_000n,
    blocksBaked: 1247,
    missedBlocks: 3,
  },
  {
    pkh: safePkh('tz1Stakefish').padEnd(36, '1').slice(0, 36),
    alias: 'Stakefish',
    status: 'active',
    fee: 0.1,
    capacity: 80_000_000_000_000n,
    totalStake: 72_000_000_000_000n,
    delegatedBalance: 60_000_000_000_000n,
    blocksBaked: 9821,
    missedBlocks: 12,
  },
  {
    pkh: safePkh('tz1TezosTeam').padEnd(36, '1').slice(0, 36),
    alias: 'Tezos Team',
    status: 'active',
    fee: 0.08,
    capacity: 70_000_000_000_000n,
    totalStake: 65_000_000_000_000n,
    delegatedBalance: 50_000_000_000_000n,
    blocksBaked: 5430,
    missedBlocks: 1,
  },
  {
    pkh: safePkh('tz1Everstake').padEnd(36, '1').slice(0, 36),
    alias: 'Everstake',
    status: 'active',
    fee: 0.07,
    capacity: 90_000_000_000_000n,
    totalStake: 78_000_000_000_000n,
    delegatedBalance: 65_000_000_000_000n,
    blocksBaked: 7621,
    missedBlocks: 8,
  },
  {
    pkh: safePkh('tz1P2PValidator').padEnd(36, '1').slice(0, 36),
    alias: 'P2P Validator',
    status: 'active',
    fee: 0.06,
    capacity: 50_000_000_000_000n,
    totalStake: 32_000_000_000_000n,
    delegatedBalance: 25_000_000_000_000n,
    blocksBaked: 2103,
    missedBlocks: 5,
  },
];

async function main(): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const baker of SEED_BAKERS) {
    const existing = await prisma.baker.findUnique({ where: { pkh: baker.pkh } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.baker.create({ data: baker });
    created++;
  }

  // eslint-disable-next-line no-console
  console.log(`[seed] bakers: created=${created} skipped=${skipped} total=${SEED_BAKERS.length}`);
}

main()
  .catch((err: unknown) => {
    console.error('[seed] failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
