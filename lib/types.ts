/**
 * Normalized reporting model.
 *
 * One row = one (date, dimension-combination) bucket of GA4 event-based user
 * counts. All derived metrics (funnel %, ECR, pp change, etc.) are computed
 * centrally in lib/metrics.ts from these raw counts — never re-derived ad
 * hoc in a component.
 */
export interface ReportingRow {
  date: string; // ISO yyyy-mm-dd
  brand: string;
  platform: string; // e.g. "Web", "Android App", "iOS App"
  device: string; // e.g. "mobile", "desktop", "tablet"
  country: string;
  /** GA4's own user/traffic geo city. NOT the delivery destination — see DIMENSIONS.md */
  ga4City: string;
  /** Reserved for a future non-GA4 delivery-destination data source. Null until wired up. */
  deliveryCity: string | null;
  trafficSource: string;
  trafficMedium: string;

  sessionStartUsers: number;
  viewItemUsers: number;
  addToCartUsers: number;
  beginCheckoutUsers: number;
  checkoutStep2Users: number;
  checkoutStep3Users: number;
  checkoutStep4Users: number;
  checkoutStep5Users: number;
  purchaseUsers: number;

  revenue: number;
  transactions: number;
}

/** Aggregated bucket of raw counts, summed across whatever rows matched a query. */
export type FunnelCounts = Pick<
  ReportingRow,
  | "sessionStartUsers"
  | "viewItemUsers"
  | "addToCartUsers"
  | "beginCheckoutUsers"
  | "checkoutStep2Users"
  | "checkoutStep3Users"
  | "checkoutStep4Users"
  | "checkoutStep5Users"
  | "purchaseUsers"
  | "revenue"
  | "transactions"
>;

export interface DateRange {
  start: string; // ISO yyyy-mm-dd, inclusive
  end: string; // ISO yyyy-mm-dd, inclusive
}

export type ComparisonMode = "d7" | "d365" | "none";

export interface DimensionFilters {
  brand?: string[];
  platform?: string[];
  device?: string[];
  country?: string[];
  ga4City?: string[];
  trafficSource?: string[];
  trafficMedium?: string[];
}

export interface DashboardQuery {
  range: DateRange;
  filters: DimensionFilters;
}

export type BreakdownDimension =
  | "ga4City"
  | "country"
  | "platform"
  | "device"
  | "brand"
  | "trafficSourceMedium";

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
  rate: number | null; // 0-100, null if denominator is 0
}

export interface FunnelStageComparison extends MetricChange {
  key: string;
  label: string;
  currentNumeratorUsers: number;
  currentDenominatorUsers: number;
}

export interface DailyTrendPoint {
  date: string;
  counts: FunnelCounts;
}

export interface BreakdownRow {
  dimensionValue: string;
  current: FunnelCounts;
  comparison: FunnelCounts;
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
  brands: string[];
  platforms: string[];
  devices: string[];
  countries: string[];
  ga4Cities: string[];
  trafficSources: string[];
  trafficMediums: string[];
  dataRange: DateRange;
}
