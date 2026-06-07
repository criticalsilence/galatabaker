import { resolveConfig, type CreateClientOptions } from './client.js';

export interface CreateTzktOptions extends CreateClientOptions {
  /** Public indexer için gerek yok. Private indexer'da bearer token. */
  apiKey?: string;
  /** Fetch override (testlerde mock'lamak için). */
  fetchImpl?: typeof fetch;
}

/**
 * TzKT indexer REST client — minimal typed fetch wrapper.
 *
 * Neden kendimiz yazıyoruz: Resmi olmayan npm paketleri @tzkt/api adı altında
 * bulunmuyor, dolayısıyla bakım riski alıyoruz. Doğrudan /v1/... JSON API'sine
 * tip güvenli bir sarmalayıcı yeterli.
 *
 * Public API dokümantasyonu: https://api.tzkt.io/
 */
export interface TzktDelegation {
  id: number;
  level: number;
  timestamp: string;
  amount: string;
  delegator: { address: string };
  sender: { address: string };
  newDelegate: { address: string } | null;
  prevDelegate: { address: string } | null;
  status: string;
}

export interface TzktAccount {
  type: string;
  address: string;
  balance: string;
  delegatedBalance: string;
  baker?: { address: string; consensusKey?: string; active: boolean };
}

export interface TzktBlockHeader {
  level: number;
  timestamp: string;
  proposer: { address: string } | null;
}

export class TzktClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(baseUrl: string, opts: { apiKey?: string; fetchImpl?: typeof fetch } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((init.headers as Record<string, string>) ?? {}),
    };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`TzKT ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  /** Son başlık (head block). */
  async getHead(): Promise<TzktBlockHeader> {
    return this.request<TzktBlockHeader>('/v1/head');
  }

  /** Adres sorgusu (boş dönerse hesap yoktur). */
  async getAccount(address: string): Promise<TzktAccount | null> {
    const rows = await this.request<TzktAccount[]>(`/v1/accounts/${encodeURIComponent(address)}`);
    return rows[0] ?? null;
  }

  /** Bir adresin delegasyonları (limit default 100, en yeni önce). */
  async getDelegations(address: string, limit = 100): Promise<TzktDelegation[]> {
    return this.request<TzktDelegation[]>(
      `/v1/operations/delegations` +
        `?delegator=${encodeURIComponent(address)}` +
        `&limit=${Math.max(1, Math.min(1000, limit))}` +
        `&sort.desc=id`,
    );
  }
}

/**
 * Yapılandırılmış seçeneklerle TzktClient oluşturur.
 *
 * - network verilmezse Ushuaia testnet
 * - overrideRpcUrl verilirse onun origin'i baseUrl olur
 */
export function createTzktClient(options: CreateTzktOptions = {}): TzktClient {
  const config = resolveConfig(options.network);
  let baseUrl = config.tzktUrl;
  if (options.overrideRpcUrl) {
    try {
      baseUrl = new URL(options.overrideRpcUrl).origin;
    } catch {
      baseUrl = config.tzktUrl;
    }
  }
  return new TzktClient(baseUrl, { apiKey: options.apiKey, fetchImpl: options.fetchImpl });
}
