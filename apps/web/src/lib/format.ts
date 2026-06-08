/**
 * Tezos mutez ↔ tez + adres kısaltma yardımcıları.
 *
 * Tezos'ta tüm zincir içi değerler mutez (1 tez = 1_000_000 mutez) cinsindendir.
 * Gösterim için tam sayı + kesir (max 6 hane) döndürürüz; trailing zero'ları
 * kırparız (1.100000 → 1.1).
 */

export function mutezToTez(mutez: string | number | bigint): string {
  const big = typeof mutez === 'bigint' ? mutez : BigInt(mutez);
  const whole = big / 1_000_000n;
  const frac = big % 1_000_000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
  return `${whole.toString()}.${fracStr}`;
}

export function truncateAddress(address: string, head = 6, tail = 4): string {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
