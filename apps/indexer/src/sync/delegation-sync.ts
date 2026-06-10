import { prisma } from '../db.js';
import { getLastSeen, setLastSeen } from '../state.js';
import type { TzktClient } from '../tzkt-client.js';

/**
 * Delegation sync — turns pending Delegation rows into confirmed /
 * failed by looking them up on chain.
 *
 * We don't create new delegation rows here — the web client posts
 * them to the API right after the wallet broadcasts the op, and the
 * row is in 'pending' state. This module is the truth-teller that
 * promotes the row to 'confirmed' / 'failed' once the op is applied.
 *
 * The unique key is `opsHash` (set when the row is created).
 */

interface TzktDelegationOp {
  id: number;
  level: number;
  timestamp: string;
  hash: string;
  sender: { address: string };
  delegate?: { address: string } | null;
  amount?: string;
  status: 'applied' | 'failed' | 'skipped' | 'backtracked';
}

export interface DelegationSyncResult {
  scanned: number;
  confirmed: number;
  failed: number;
  lastLevel: number;
}

export class DelegationSync {
  constructor(
    private readonly tzkt: TzktClient,
    private readonly batchSize: number,
  ) {}

  async run(): Promise<DelegationSyncResult> {
    const fromLevel = await getLastSeen('delegations');
    const head = await this.tzkt
      .get<Array<{ level: number }>>('/v1/head', { select: 'level' })
      .then((h) => h[0]?.level ?? fromLevel)
      .catch(() => fromLevel);
    const toLevel = Math.max(head, fromLevel);
    if (toLevel <= fromLevel) {
      return { scanned: 0, confirmed: 0, failed: 0, lastLevel: fromLevel };
    }

    let offset = 0;
    let scanned = 0;
    let confirmed = 0;
    let failed = 0;

    for (;;) {
      const page = await this.tzkt.get<TzktDelegationOp[]>('/v1/operations/delegations', {
        level: fromLevel,
        'level.le': toLevel,
        limit: this.batchSize,
        offset,
        sort: 'asc',
        'status.in': 'applied,failed,skipped,backtracked',
        select: 'id,level,timestamp,hash,sender,delegate,amount,status',
      });
      if (page.length === 0) break;
      scanned += page.length;
      for (const op of page) {
        const row = await prisma.delegation.findFirst({
          where: { opsHash: op.hash, status: 'PENDING' },
        });
        if (!row) continue;
        await prisma.delegation.update({
          where: { id: row.id },
          data:
            op.status === 'applied'
              ? { status: 'CONFIRMED', blockLevel: op.level, blockTime: new Date(op.timestamp) }
              : {
                  status: 'FAILED',
                  errorMessage: `tzkt status=${op.status}`,
                  blockLevel: op.level,
                  blockTime: new Date(op.timestamp),
                },
        });
        if (op.status === 'applied') confirmed++;
        else failed++;
      }
      if (page.length < this.batchSize) break;
      offset += this.batchSize;
    }

    if (scanned > 0) await setLastSeen('delegations', toLevel);
    return { scanned, confirmed, failed, lastLevel: toLevel };
  }
}
