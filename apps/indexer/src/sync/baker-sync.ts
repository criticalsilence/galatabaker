import { prisma } from '../db.js';
import type { TzktClient } from '../tzkt-client.js';

/**
 * Baker sync — refreshes the local Baker table from TzKT.
 *
 * The bakers endpoint returns the delegate snapshot at the chain
 * head. We upsert by `pkh` so baker metadata stays current. Closed
 * bakers are kept in the DB (delegations reference them) but get
 * `status='closed'` — the API hides them by default.
 */

interface TzktDelegate {
  address: string;
  alias?: string;
  active: boolean;
  fee: number; // basis points, e.g. 500 = 5%
  stakingBalance: string;
  delegatedBalance: string;
  limitOfStakingBalance: string;
  blocksBaked: number;
  blocksMissed: number;
}

export interface BakerSyncResult {
  scanned: number;
  upserted: number;
}

export class BakerSync {
  constructor(private readonly tzkt: TzktClient) {}

  async run(): Promise<BakerSyncResult> {
    const delegates = await this.tzkt.get<TzktDelegate[]>('/v1/delegates', {
      active: true,
      limit: 500,
      select:
        'address,alias,active,fee,stakingBalance,delegatedBalance,limitOfStakingBalance,blocksBaked,blocksMissed',
    });

    let upserted = 0;
    for (const d of delegates) {
      await prisma.baker.upsert({
        where: { pkh: d.address },
        create: {
          pkh: d.address,
          alias: d.alias ?? null,
          status: d.active ? 'active' : 'closed',
          fee: d.fee,
          totalStake: BigInt(d.stakingBalance),
          delegatedBalance: BigInt(d.delegatedBalance),
          capacity: BigInt(d.limitOfStakingBalance),
          blocksBaked: d.blocksBaked,
          missedBlocks: d.blocksMissed,
          lastSeen: new Date(),
        },
        update: {
          alias: d.alias ?? null,
          status: d.active ? 'active' : 'closed',
          fee: d.fee,
          totalStake: BigInt(d.stakingBalance),
          delegatedBalance: BigInt(d.delegatedBalance),
          capacity: BigInt(d.limitOfStakingBalance),
          blocksBaked: d.blocksBaked,
          missedBlocks: d.blocksMissed,
          lastSeen: new Date(),
        },
      });
      upserted++;
    }
    return { scanned: delegates.length, upserted };
  }
}
