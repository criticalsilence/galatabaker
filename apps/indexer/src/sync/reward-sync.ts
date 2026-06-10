import { prisma } from '../db.js';
import { getLastSeen, setLastSeen } from '../state.js';
import type { TzktClient } from '../tzkt-client.js';

/**
 * Reward sync — pulls reward ops from TzKT and upserts them.
 *
 * TzKT endpoint: GET /v1/operations/rewards?level.ge={last}&limit=1000
 *   - paginates via offset (TzKT v1, not v2)
 *   - returns one row per (cycle, recipient) for the given level range
 *
 * Idempotency:
 *   - we upsert on `opsHash` (unique in the DB) so re-runs are safe
 *   - if the recipient hasn't registered with GalataBaker we skip
 *     silently — there's no user to attach the reward to
 */

interface TzktRewardOp {
  id: number;
  level: number;
  timestamp: string;
  baker: { alias?: string; address: string } | null;
  proposer: { alias?: string; address: string } | null;
  /** recipient: tz1..tz4 address (the one we attach to a User) */
  recipient: string;
  /** reward amount in mutez (string, JSON has no BigInt) */
  reward: string;
  /** 'rewards' or 'bonus' — we collapse both into 'rewards' for MVP */
  type?: string;
  /** pre-baked opsHash? on rewards endpoint it's missing, we synthesize */
}

export interface RewardSyncResult {
  scanned: number;
  inserted: number;
  skipped: number;
  lastLevel: number;
}

export class RewardSync {
  constructor(
    private readonly tzkt: TzktClient,
    private readonly batchSize: number,
  ) {}

  async run(): Promise<RewardSyncResult> {
    const fromLevel = await getLastSeen('rewards');
    const head = await this.tzkt
      .get<Array<{ level: number }>>('/v1/head', { select: 'level' })
      .then((h) => h[0]?.level ?? fromLevel)
      .catch(() => fromLevel);
    const toLevel = Math.max(head, fromLevel);
    if (toLevel <= fromLevel) {
      return { scanned: 0, inserted: 0, skipped: 0, lastLevel: fromLevel };
    }

    let offset = 0;
    let inserted = 0;
    let skipped = 0;
    let scanned = 0;

    for (;;) {
      const page = await this.tzkt.get<TzktRewardOp[]>('/v1/operations/rewards', {
        level: fromLevel,
        'level.le': toLevel,
        limit: this.batchSize,
        offset,
        sort: 'asc',
        select: 'id,level,timestamp,baker,proposer,reward,recipient',
      });
      if (page.length === 0) break;
      scanned += page.length;
      for (const op of page) {
        const user = await prisma.user.findUnique({ where: { walletPkh: op.recipient } });
        if (!user) {
          skipped++;
          continue;
        }
        const bakerPkh = op.baker?.address ?? op.proposer?.address;
        if (!bakerPkh) {
          skipped++;
          continue;
        }
        const opsHash = `tzkt:${op.id}`;
        await prisma.reward.upsert({
          where: { opsHash },
          create: {
            opsHash,
            userId: user.id,
            bakerPkh,
            cycle: await cycleFromLevel(op.level, this.tzkt),
            kind: 'BAKING',
            amount: BigInt(op.reward),
            blockTime: new Date(op.timestamp),
          },
          update: {}, // immutable once inserted
        });
        inserted++;
      }
      if (page.length < this.batchSize) break;
      offset += this.batchSize;
    }

    if (scanned > 0) await setLastSeen('rewards', toLevel);
    return { scanned, inserted, skipped, lastLevel: toLevel };
  }
}

async function cycleFromLevel(level: number, tzkt: TzktClient): Promise<number> {
  // TzKT /v1/cycles/{level} gives us the cycle for a level; cache inline
  // in process so a long page of rewards doesn't re-query.
  const c = await tzkt.get<Array<{ index: number }>>(`/v1/cycles/${level}`);
  return c[0]?.index ?? 0;
}
