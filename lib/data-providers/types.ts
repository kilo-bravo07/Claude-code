import type {
  BreakdownDimension,
  BreakdownRow,
  DailyTrendPoint,
  DashboardQuery,
  DataQualityCheckResult,
  FilterOptions,
  RawCounts,
} from "../types";
import type { PropertyConfig } from "../properties/types";

/**
 * The one seam between GA4 (or any future source) and the rest of the app.
 * Nothing outside this directory should ever call a GA4 SDK or shape a GA4
 * report request directly — everything goes through this interface so the
 * mock and real implementations are interchangeable. Every method is handed
 * the full PropertyConfig so it knows which GA4 property, event names, and
 * funnel shape to use — the frontend only ever passes a property *key*.
 */
export interface DataProvider {
  /** Human-readable name shown in the UI footer ("Demo Data" / "GA4 Live"). */
  readonly mode: "mock" | "ga4";

  getFunnelCounts(property: PropertyConfig, query: DashboardQuery): Promise<RawCounts>;

  getDailyTrend(property: PropertyConfig, query: DashboardQuery): Promise<DailyTrendPoint[]>;

  getBreakdown(
    property: PropertyConfig,
    query: DashboardQuery,
    dimension: BreakdownDimension,
    comparison: DashboardQuery | null,
  ): Promise<BreakdownRow[]>;

  getDataQuality(property: PropertyConfig, query: DashboardQuery): Promise<DataQualityCheckResult[]>;

  getFilterOptions(property: PropertyConfig): Promise<FilterOptions>;
}
