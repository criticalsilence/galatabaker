/**
 * GalataBaker API — Rewards polling scheduler (STUB).
 *
 * MVP'de sadece heartbeat log atar. Adım 6'da (gerçek indexer geldiğinde)
 * burası şu işi yapacak:
 *
 *   1. TzKT'den son 5 dakikadaki reward op'lerini çek
 *      → GET /v1/operations/rewards?level.ge={lastSeenLevel}
 *   2. Her op için ilgili user'ı bul/görüntüle (User modelinde
 *      walletPkh → userId)
 *   3. Reward modeline upsert (userId, opsHash, kind composite unique)
 *   4. lastSeenLevel güncelle (scheduler instance state veya DB)
 *   5. Pending claim'leri kontrol et (claimed=false olan reward'lar
 *      için ilgili user'ın wallet'ında fonksiyonel claim tx'i var mı)
 *
 * Şu an: log atar — Adım 6'ya kadar bu stub kalacak. Test'lerde
 * scheduler handle'ı ayrıca test edilmiyor (Cron decorator + manual
 * trigger MVP dışı).
 *
 * @see Step 6 plan (Adım 6: indexer implementation).
 */

import { Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

export const REWARDS_POLLING_CRON = CronExpression.EVERY_5_MINUTES;

export class RewardsScheduler {
  private readonly logger = new Logger(RewardsScheduler.name);

  @Cron(REWARDS_POLLING_CRON)
  async pollRewards(): Promise<void> {
    // TODO step 6: implement real polling via TzKT
    this.logger.log('[rewards] polling tick (stub — indexer TBD step 6)');
  }
}
