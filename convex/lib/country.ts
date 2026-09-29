/**
 * Cloudflare reports "XX" when it cannot place a client and "T1" for Tor exit
 * nodes. Neither is a country, so neither is stored.
 */
const NOT_A_COUNTRY = new Set(["XX", "T1"]);

/** A clean upper-case ISO 3166-1 alpha-2 code, or `null` when the value is not one. */
export function normalizeCountry(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(code) && !NOT_A_COUNTRY.has(code) ? code : null;
}
