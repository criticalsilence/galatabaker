/**
 * Indexer state — last seen block level per resource.
 *
 * A single-key/value table in the API's existing Postgres, so the
 * indexer can resume after a restart without re-scanning the whole
 * chain. Keyed by resource name (e.g. 'rewards', 'delegations').
 */

import { prisma } from './db.js';

export async function getLastSeen(resource: string): Promise<number> {
  const row = await prisma.indexerState.findUnique({ where: { key: resource } });
  return row ? Number(row.value) : 0;
}

export async function setLastSeen(resource: string, level: number): Promise<void> {
  await prisma.indexerState.upsert({
    where: { key: resource },
    create: { key: resource, value: BigInt(level) },
    update: { value: BigInt(level) },
  });
}
