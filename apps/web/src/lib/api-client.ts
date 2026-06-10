/**
 * GalataBaker web — typed fetch wrapper around the NestJS API.
 *
 * Responsibilities:
 *   - Prefix every request with API_BASE_URL
 *   - Auto-inject Authorization: Bearer <jwt> when token is set
 *   - Parse JSON responses (including BigInt-as-string numbers)
 *   - Normalize 4xx/5xx errors into ApiError instances so TanStack Query
 *     and React components get a consistent shape
 *
 * Non-responsibilities:
 *   - JWT storage (lives in lib/auth-store.ts)
 *   - Token refresh (no refresh tokens in MVP; tokens expire → re-sign-in)
 *   - Retries (TanStack Query handles retry policy at the hook level)
 */

import { API_BASE_URL } from './api-config';

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: ApiErrorBody,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  /** Bearer token; omit for public endpoints. */
  token?: string | null;
  /** Query string params; null/undefined values are dropped. */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Pre-built URLSearchParams for complex queries. */
  searchParams?: URLSearchParams;
  /** Request body (auto-JSON-stringified). */
  body?: unknown;
  /** Custom headers; Authorization is added after this. */
  headers?: Record<string, string>;
  /** AbortSignal forwarding. */
  signal?: AbortSignal;
}

function buildUrl(path: string, opts: RequestOptions = {}): string {
  const base = API_BASE_URL.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const params = new URLSearchParams();
  if (opts.searchParams) {
    opts.searchParams.forEach((v, k) => params.append(k, v));
  }
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === null || v === undefined) continue;
      params.append(k, String(v));
    }
  }
  const qs = params.toString();
  return qs ? `${base}${cleanPath}?${qs}` : `${base}${cleanPath}`;
}

export async function apiGet<T>(path: string, opts?: RequestOptions): Promise<T> {
  return request<T>('GET', path, opts);
}

export async function apiPost<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  return request<T>('POST', path, { ...opts, body });
}

export async function apiPut<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  return request<T>('PUT', path, { ...opts, body });
}

export async function apiPatch<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  return request<T>('PATCH', path, { ...opts, body });
}

export async function apiDelete<T>(path: string, opts?: RequestOptions): Promise<T> {
  return request<T>('DELETE', path, opts);
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, opts);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...opts.headers,
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let payload: BodyInit | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(opts.body);
  }

  const res = await fetch(url, { method, headers, body: payload, signal: opts.signal });

  // 204 / empty body → return undefined cast to T
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Non-JSON body (shouldn't happen for our API). Surface as ApiError
      // with the raw text so callers can still see what came back.
      if (!res.ok) {
        throw new ApiError(res.status, text || res.statusText);
      }
      data = text;
    }
  }

  if (!res.ok) {
    const errBody = (data ?? {}) as ApiErrorBody;
    const message = Array.isArray(errBody.message)
      ? errBody.message.join('; ')
      : errBody.message || res.statusText;
    throw new ApiError(res.status, message, errBody);
  }
  return data as T;
}
