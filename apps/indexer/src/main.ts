import { loadConfig, type Config } from './config.js';
import { BakerSync } from './sync/baker-sync.js';
import { DelegationSync } from './sync/delegation-sync.js';
import { RewardSync } from './sync/reward-sync.js';
import { TzktHttpClient } from './tzkt-client.js';

/**
 * Main loop — orchestrates the three sync modules.
 *
 * Order on each tick:
 *   1. bakers   (cheap, idempotent, re-runs every tick)
 *   2. rewards  (cheap, append-only)
 *   3. delegations (mutates existing rows, runs after rewards so
 *                   the per-cycle progress shows up together)
 *
 * Errors are caught per-resource so a single broken sync doesn't
 * stall the others. Sleep, repeat. SIGINT / SIGTERM triggers a
 * graceful shutdown.
 */

let running = true;

function attachShutdown(): void {
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      // eslint-disable-next-line no-console
      console.log(`[main] received ${sig}, shutting down`);
      running = false;
    });
  }
}

export interface MainResult {
  ticks: number;
  reason: 'shutdown' | 'error';
}

export async function runMain(cfg: Config = loadConfig()): Promise<MainResult> {
  attachShutdown();
  const tzkt = new TzktHttpClient(cfg.TZKT_BASE_URL);
  const bakers = new BakerSync(tzkt);
  const rewards = new RewardSync(tzkt, cfg.BATCH_SIZE);
  const delegations = new DelegationSync(tzkt, cfg.BATCH_SIZE);

  let ticks = 0;
  while (running) {
    for (const [name, fn] of [
      ['bakers', () => bakers.run()],
      ['rewards', () => rewards.run()],
      ['delegations', () => delegations.run()],
    ] as const) {
      if (!running) break;
      try {
        const r = await fn();
        // eslint-disable-next-line no-console
        console.log(`[main] ${name} tick#${ticks}`, r);
      } catch (err) {
        console.error(`[main] ${name} tick#${ticks} failed`, err);
      }
    }
    ticks++;
    await new Promise((r) => setTimeout(r, cfg.INTERVAL_MS));
  }
  return { ticks, reason: 'shutdown' };
}
