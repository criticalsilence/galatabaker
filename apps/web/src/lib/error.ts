/**
 * Bilinmeyen bir hata değerinden kullanıcıya gösterilecek temiz bir mesaj çıkar.
 *
 * Beacon SDK 4.x, `requestPermissions` sırasında çeşitli hata türleri
 * fırlatır:
 *
 * 1. Standart `Error` (nadir) — `e.message` yeterli
 * 2. `BeaconError extends Error` — `title` + `description` alanları
 *    insan-okunur metni taşır; `message` genelde sadece title'dır
 * 3. Plain object (Temple bridge kaynaklı) — `description`, `message`,
 *    `title` veya `error` field'larından biri olabilir; hiçbiri yoksa
 *    `[object Object]` yerine güvenli bir fallback
 *
 * React'te `{error}` render edildiğinde object ise otomatik olarak
 * `[object Object]`'e dönüşür; bu fonksiyon onu önler.
 */
export function extractErrorMessage(e: unknown): string {
  // String
  if (typeof e === 'string') {
    return e.trim() || 'Unknown error';
  }

  // null / undefined
  if (e === null || e === undefined) {
    return 'Unknown error';
  }

  // Error instance (BeaconError, WalletNotFoundError, ...)
  if (e instanceof Error) {
    const be = e as unknown as {
      title?: unknown;
      description?: unknown;
      name?: string;
    };

    // description en kullanışlı alan (Temple: "Wallet connection was cancelled")
    if (typeof be.description === 'string' && be.description.trim()) {
      return be.description.trim();
    }
    // title makine-okunur (BeaconError: "WalletNotFound")
    if (typeof be.title === 'string' && be.title.trim()) {
      return be.title.trim();
    }
    // message standart Error alanı; "[object Object]" olabilir
    if (typeof e.message === 'string' && e.message && e.message !== '[object Object]') {
      return e.message;
    }
    // Son çare: Error.name (örn. "TypeError")
    return e.name || 'Error';
  }

  // Plain object (Temple bridge, postMessage response)
  if (typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    const candidates: Array<unknown> = [
      obj.description,
      obj.message,
      obj.title,
      obj.error,
      obj.reason,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim() && c.trim() !== '[object Object]') {
        return c.trim();
      }
    }
    // Son çare: JSON.stringify (daire referans olabilir, try/catch)
    try {
      const json = JSON.stringify(e);
      if (json && json !== '{}' && json.length < 500) {
        return json;
      }
    } catch {
      // yoksay
    }
    return 'Unknown error (no message)';
  }

  return String(e);
}
