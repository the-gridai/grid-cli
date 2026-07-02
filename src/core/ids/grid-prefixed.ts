import { z } from 'zod';

const uuidSchema = z.string().uuid();

/**
 * GridExchange wire form uses hyphenated prefixes (`market-<uuid>`, `instrument-<uuid>`).
 * Legacy ME configs used `market_<uuid>` / `instrument_<uuid>`.
 */
export function stripGridMarketPrefix(id: string): string {
  if (id.startsWith('market-')) return id.slice('market-'.length);
  if (id.startsWith('market_')) return id.slice('market_'.length);
  return id;
}

export function stripGridInstrumentPrefix(id: string): string {
  if (id.startsWith('instrument-')) return id.slice('instrument-'.length);
  if (id.startsWith('instrument_')) return id.slice('instrument_'.length);
  return id;
}

/** Normalize to GX `market-<uuid>` when the tail is a UUID; otherwise return as-is. */
export function normalizeGridMarketId(id: string): string {
  const raw = stripGridMarketPrefix(id);
  return uuidSchema.safeParse(raw).success ? `market-${raw}` : id;
}

/** Normalize to GX `instrument-<uuid>` when the tail is a UUID; otherwise return as-is. */
export function normalizeGridInstrumentId(id: string): string {
  const raw = stripGridInstrumentPrefix(id);
  return uuidSchema.safeParse(raw).success ? `instrument-${raw}` : id;
}

function isGridMarketIdLike(s: string): boolean {
  return uuidSchema.safeParse(s).success || uuidSchema.safeParse(stripGridMarketPrefix(s)).success;
}

function isGridInstrumentIdLike(s: string): boolean {
  return uuidSchema.safeParse(s).success || uuidSchema.safeParse(stripGridInstrumentPrefix(s)).success;
}

/** Config input: bare UUID, `market-<uuid>`, or legacy `market_<uuid>`. */
export const GridMarketIdInputSchema = z
  .string()
  .min(1)
  .refine(isGridMarketIdLike, { message: 'marketId must be a UUID or market-<uuid> (or legacy market_<uuid>)' });

/** Config input: bare UUID, `instrument-<uuid>`, or legacy `instrument_<uuid>`. */
export const GridInstrumentIdInputSchema = z
  .string()
  .min(1)
  .refine(isGridInstrumentIdLike, {
    message: 'instrumentId must be a UUID or instrument-<uuid> (or legacy instrument_<uuid>)',
  });
