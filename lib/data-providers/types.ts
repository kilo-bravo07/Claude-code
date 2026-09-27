import type {
  BreakdownDimension,
  BreakdownRow,
  DailyTrendPoint,
  DashboardQuery,
  DataQualityCheckResult,
  FilterOptions,
  FunnelCounts,
} from "../types";

/**
 * The one seam between GA4 (or any future source) and the rest of the app.
 * Nothing outside this directory should ever call a GA4 SDK or shape a GA4
 * report request directly — everything goes through this interface so the
 * mock and real implementations are interchangeable.
 */
export interface DataProvider {
  /** Human-readable name shown in the UI footer ("Demo Data" / "GA4 Live"). */
  readonly mode: "mock" | "ga4";

  getFunnelCounts(query: DashboardQuery): Promise<FunnelCounts>;

  getDailyTrend(query: DashboardQuery): Promise<DailyTrendPoint[]>;

  getBreakdown(query: DashboardQuery, dimension: BreakdownDimension, comparison: DashboardQuery | null): Promise<BreakdownRow[]>;

  getDataQuality(query: DashboardQuery): Promise<DataQualityCheckResult[]>;

  getFilterOptions(): Promise<FilterOptions>;
}
