/**
 * Date-range resolution for `grid consumption stats`.
 *
 * Kept free of UI imports so it can be unit tested without pulling in ink.
 */

/** Formats a Date as `YYYY-MM-DD` in UTC, matching the API's date filters. */
function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export interface DateRangeOptions {
  from?: string;
  to?: string;
  days?: string;
}

/**
 * Resolves the inclusive start and exclusive end dates.
 *
 * The API's end bound is exclusive, so including today means passing tomorrow.
 */
export function resolveDateRange(
  options: DateRangeOptions,
  today: Date = new Date(),
): { from: string; to: string } {
  const to = options.to ?? toIsoDate(addDays(today, 1));

  if (options.from) {
    return { from: options.from, to };
  }

  const days = options.days ? Number(options.days) : 7;
  if (!Number.isInteger(days) || days < 1) {
    throw new Error('--days must be a positive integer');
  }

  return { from: toIsoDate(addDays(new Date(`${to}T00:00:00Z`), -days)), to };
}
