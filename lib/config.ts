/**
 * Single source of truth for tunable dashboard behaviour.
 * Do not hardcode these thresholds anywhere else in the app.
 */

/** Percentage-point change thresholds used to classify drop severity (section 6 of spec). */
export const SEVERITY_THRESHOLDS = {
  /** change >= this many pp -> IMPROVED */
  improvedPp: 1,
  /** change <= -this many pp -> DROP; between -stable and +improved is STABLE */
  dropPp: -1,
  /** change <= this many pp -> MAJOR_DROP (more negative than dropPp) */
  majorDropPp: -3,
};

/** Default comparison mode shown on first load. */
export const DEFAULT_COMPARISON_MODE = "d7" as const;

/** How many rows to show by default in "Where did ECR drop?" tables. */
export const DROP_TABLE_DEFAULT_ROWS = 10;

/**
 * Minimum volume (the property's shopping-funnel root count, e.g. Session
 * Start users) a breakdown row must have in the CURRENT period before it's
 * eligible for "Where did ECR drop?" ranking. Real GA4 city/source-medium
 * breakdowns have a long tail of dimension values with a handful of users
 * each, where one purchase more-or-less swings ECR by 100 pp — that's
 * sampling noise, not a real drop worth investigating, and would otherwise
 * dominate the ranking ahead of genuinely large, meaningful movements. This
 * does not affect the plain (non-drop-ranked) breakdown tables, which still
 * show every row.
 */
export const MIN_VOLUME_FOR_DROP_RANKING = 30;

/**
 * Data quality thresholds. A stage's user count relative to session_start
 * users (or the previous day for the same stage) below this ratio triggers
 * a warning instead of being presented as a pure business movement.
 */
export const DATA_QUALITY = {
  /** If an event that normally fires has zero users for the whole selected range, flag critical. */
  zeroEventIsCritical: true,
  /** Day-over-day drop in an event's raw volume larger than this fraction is "abnormal". */
  abnormalDropFraction: 0.6,
  /** Minimum acceptable coverage ratio for item-level dimensions (item_id, item_category, item_list_name). */
  minItemDimensionCoverage: 0.85,
};

/** In-memory cache TTL for provider responses, in milliseconds. */
export const CACHE_TTL_MS = 5 * 60 * 1000;

// Funnel shapes are no longer hardcoded here — each property defines its own
// shopping/checkout FunnelDefinition in lib/properties/*.ts, since the four
// GA4 properties this dashboard supports have genuinely different funnels
// (different event names, different stage counts, different labels).

export const BREAKDOWN_DIMENSIONS = [
  { key: "ga4City", label: "GA4 City" },
  { key: "country", label: "Country" },
  { key: "device", label: "Device" },
  { key: "trafficSourceMedium", label: "Source / Medium" },
] as const;

/**
 * A sequential funnel stage converting at >100% (numerator > denominator) is
 * never capped or silently corrected — see lib/metrics.ts. It is always
 * surfaced as a data-quality warning instead, using this exact wording.
 */
export const OVER_100_PERCENT_WARNING =
  "Step conversion >100% — investigate event/user counting methodology.";
