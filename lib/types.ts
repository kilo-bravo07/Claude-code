/**
 * Normalized reporting model — generic across all four GA4 properties.
 *
 * Unlike the original single-property version, raw counts are no longer a
 * fixed set of named fields (sessionStartUsers, viewItemUsers, ...): each
 * property defines its own funnel shape (lib/properties/*.ts), so raw counts
 * are a dynamic bag keyed by whatever stage/root/extra-metric keys that
 * property declares. `lib/metrics.ts` reads this bag using the property's
 * FunnelDefinition — it never assumes a fixed shape.
 */
import type { FilterKey, PropertyKey } from "./properties/types";

/** Dynamic bag of raw counts keyed by funnel stage/root/extra-metric key (plus the conventional "revenue"/"transactions" keys when available). */
export type RawCounts = Record<string, number>;

export interface DateRange {
  start: string; // ISO yyyy-mm-dd, inclusive
  end: string; // ISO yyyy-mm-dd, inclusive
}

export type ComparisonMode = "d7" | "d365" | "none";

export type DimensionFilters = Partial<Record<FilterKey, string[]>>;

export interface DashboardQuery {
  property: PropertyKey;
  range: DateRange;
  filters: DimensionFilters;
}

/** Breakdown dimensions "Where did ECR drop?" can group by — a subset of FilterKey (trafficSource+trafficMedium are combined into one breakdown column). */
export type BreakdownDimension = "ga4City" | "country" | "device" | "trafficSourceMedium";

/** Direction/severity vocabulary shared by every "highlight the drop" surface. */
export type ChangeSeverity = "MAJOR_DROP" | "DROP" | "STABLE" | "IMPROVED";

export interface MetricChange {
  currentValue: number | null;
  comparisonValue: number | null;
  /** current - comparison, in percentage points (both values already expressed as 0-100). */
  ppChange: number | null;
  /** (current - comparison) / comparison, as a fraction (e.g. 0.05 = +5%). */
  relativeChange: number | null;
  severity: ChangeSeverity;
}

export interface FunnelStageResult {
  key: string;
  label: string;
  /** Numerator / denominator user counts behind the percentage, for transparency. */
  numeratorUsers: number;
  denominatorUsers: number;
  /** 0-100, null if denominator is 0. Intentionally NOT capped at 100 — see lib/metrics.ts. */
  rate: number | null;
}

export interface FunnelStageComparison extends MetricChange {
  key: string;
  label: string;
  currentNumeratorUsers: number;
  currentDenominatorUsers: number;
}

export interface DailyTrendPoint {
  date: string;
  counts: RawCounts;
}

export interface BreakdownRow {
  dimensionValue: string;
  current: RawCounts;
  comparison: RawCounts;
  shoppingEcr: MetricChange;
  checkoutEcr: MetricChange;
}

export type DataQualitySeverity = "ok" | "warning" | "critical";

export interface DataQualityCheckResult {
  id: string;
  label: string;
  severity: DataQualitySeverity;
  message: string;
  /** Machine-readable detail, e.g. the coverage ratio or event count observed. */
  detail?: Record<string, number | string | null>;
}

export interface FilterOptions {
  devices: string[];
  countries: string[];
  ga4Cities: string[];
  trafficSources: string[];
  trafficMediums: string[];
  dataRange: DateRange;
}
