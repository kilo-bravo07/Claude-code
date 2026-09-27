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

export const SHOPPING_FUNNEL_STAGES = [
  { key: "viewItem", label: "View Item" },
  { key: "addToCart", label: "Add to Cart" },
  { key: "checkout", label: "Checkout" },
  { key: "purchase", label: "Purchase" },
] as const;

export const CHECKOUT_FUNNEL_STAGES = [
  { key: "step2", label: "Step 2" },
  { key: "step3", label: "Step 3" },
  { key: "step4", label: "Step 4" },
  { key: "step5", label: "Step 5" },
  { key: "purchase", label: "Purchase" },
] as const;

export const BREAKDOWN_DIMENSIONS = [
  { key: "ga4City", label: "GA4 City" },
  { key: "country", label: "Country" },
  { key: "platform", label: "Platform" },
  { key: "device", label: "Device" },
  { key: "brand", label: "Brand" },
  { key: "trafficSourceMedium", label: "Source / Medium" },
] as const;
