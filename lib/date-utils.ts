import type { ComparisonMode, DateRange } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parses an ISO yyyy-mm-dd string as a UTC-midnight Date, avoiding local-TZ drift. */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return formatIsoDate(d);
}

export function daysBetween(startIso: string, endIso: string): number {
  return Math.round((parseIsoDate(endIso).getTime() - parseIsoDate(startIso).getTime()) / MS_PER_DAY);
}

export function isSingleDay(range: DateRange): boolean {
  return range.start === range.end;
}

/**
 * Computes the comparison period for a given range and mode.
 *
 * Single day (spec section 5):
 *   D-7:   current date shifted back 7 days
 *   D-365: current date shifted back 365 days
 *
 * Date range: shift both endpoints back by the same number of days
 * (7 for D-7, 365 for D-365), preserving range length.
 */
export function getComparisonRange(range: DateRange, mode: ComparisonMode): DateRange | null {
  if (mode === "none") return null;
  const shift = mode === "d7" ? 7 : 365;
  return {
    start: addDays(range.start, -shift),
    end: addDays(range.end, -shift),
  };
}

export function comparisonLabel(mode: ComparisonMode): string {
  switch (mode) {
    case "d7":
      return "D-7";
    case "d365":
      return "D-365 (YoY)";
    default:
      return "No comparison";
  }
}

/** Inclusive list of ISO dates between start and end. */
export function enumerateDates(range: DateRange): string[] {
  const out: string[] = [];
  let cursor = range.start;
  while (cursor <= range.end) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function today(): string {
  return formatIsoDate(new Date());
}
