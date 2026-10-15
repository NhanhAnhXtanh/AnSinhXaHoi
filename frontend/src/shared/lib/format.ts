/**
 * How a date is written, everywhere.
 *
 * There were two shapes on screen at once and both were right on their own:
 * `toLocaleDateString(…, { month: "short" })` gave "Aug 23, 2026" and a bare
 * `toLocaleString()` gave "8/31/2026, 4:00:24 PM". A detail card showing both,
 * two rows apart, makes the reader work out that they are the same kind of
 * value — and the seconds are noise on a record nobody is timing.
 *
 * Both formatters take the browser's locale rather than a fixed one, which is
 * the point of `undefined` here: the *shape* is the application's decision,
 * the *language* is the reader's.
 */

const DATE: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

const DATE_TIME: Intl.DateTimeFormatOptions = {
  ...DATE,
  hour: "2-digit",
  minute: "2-digit",
};

/** The em dash, not an empty cell — a blank reads as a rendering failure. */
export const EMPTY = "—";

export function formatDate(value?: string | null): string {
  if (!value) return EMPTY;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? EMPTY
    : date.toLocaleDateString(undefined, DATE);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return EMPTY;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? EMPTY
    : date.toLocaleString(undefined, DATE_TIME);
}
