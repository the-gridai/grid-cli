/**
 * Stable market keys for routing and per-market APIs.
 *
 * The exchange exposes market IDs like `market_<uuid>` and GX may emit
 * `market-<uuid>`. Configs may store either the
 * full prefixed form or a bare UUID in `marketId`. We normalize to a single
 * canonical string for Map keys and URL paths.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Normalize a market id to canonical form: `market_<lowercase-uuid>`.
 * Accepts `market_<uuid>`, `market-<uuid>`, bare UUID, or empty/undefined
 * (returns empty string).
 */
export function normalizeMarketKey(marketId: string | undefined | null): string {
  if (marketId == null || marketId === '') {
    return '';
  }
  const trimmed = String(marketId).trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('market_')) {
    const rest = lower.slice('market_'.length);
    return UUID_RE.test(rest) ? `market_${rest}` : lower;
  }
  if (lower.startsWith('market-')) {
    const rest = lower.slice('market-'.length);
    return UUID_RE.test(rest) ? `market_${rest}` : lower;
  }
  if (UUID_RE.test(lower)) {
    return `market_${lower}`;
  }
  return lower;
}

/**
 * True if the string looks like a normalized market key or bare UUID.
 */
export function isMarketIdLike(value: string | undefined | null): boolean {
  if (value == null || value === '') return false;
  const v = String(value).trim().toLowerCase();
  if (v.startsWith('market_') || v.startsWith('market-')) {
    return UUID_RE.test(v.slice('market_'.length));
  }
  return UUID_RE.test(v);
}
