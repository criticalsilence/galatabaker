/**
 * TzKT HTTP client — fetch wrapper with retry + 10 req/s throttle.
 *
 * Why client-side throttle:
 *   TzKT public API has a soft 10 req/s limit per IP. We
 *   don't want a runner to be blocked for hitting it.
 *
 * Why retry with backoff:
 *   5xx from TzKT happens during chain reorgs. We wait and
 *   retry; if it keeps failing the caller logs and moves on.
 */

const DEFAULT_THROTTLE_MS = 100;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = [1_000, 3_000, 5_000];

let lastCallAt = 0;
const waitQueue: Array<() => void> = [];

async function throttle(throttleMs: number): Promise<void> {
  if (waitQueue.length > 0) {
    await new Promise<void>((r) => waitQueue.push(r));
  }
  const elapsed = Date.now() - lastCallAt;
  const wait = throttleMs - elapsed;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastCallAt = Date.now();
  const next = waitQueue.shift();
  next?.();
}

export interface TzktClient {
  get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T>;
}

export interface TzktClientOptions {
  /** Minimum ms between calls; defaults to 100 (10 req/s). */
  throttleMs?: number;
  /** Backoff between retries in ms; defaults to [500, 1500, 3000]. */
  backoffMs?: number[];
  /** Max retry attempts; defaults to 3. */
  maxRetries?: number;
}

export class TzktHttpClient implements TzktClient {
  private readonly throttleMs: number;
  private readonly maxRetries: number;
  private readonly backoffMs: number[];

  constructor(
    private readonly baseUrl: string,
    opts: TzktClientOptions = {},
  ) {
    this.throttleMs = opts.throttleMs ?? DEFAULT_THROTTLE_MS;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.backoffMs = opts.backoffMs ?? DEFAULT_BACKOFF_MS;
  }

  async get<T>(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {},
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
    let lastErr: unknown;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      await throttle(this.throttleMs);
      try {
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`TzKT ${res.status} on ${path}`);
          await new Promise((r) => setTimeout(r, this.backoffMs[attempt] ?? 5_000));
          continue;
        }
        if (!res.ok) throw new Error(`TzKT ${res.status} on ${path}: ${await res.text()}`);
        return (await res.json()) as T;
      } catch (err) {
        lastErr = err;
        if (attempt < this.maxRetries - 1) {
          await new Promise((r) => setTimeout(r, this.backoffMs[attempt] ?? 5_000));
        }
      }
    }
    throw lastErr ?? new Error('TzKT request failed');
  }
}
