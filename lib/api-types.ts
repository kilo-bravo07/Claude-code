import type {
  BreakdownDimension,
  BreakdownRow,
  ComparisonMode,
  DailyTrendPoint,
  DataQualityCheckResult,
  DateRange,
  FilterOptions,
  FunnelCounts,
} from "./types";

export type ProviderMode = "mock" | "ga4";

export interface FunnelCountsResponse {
  mode: ProviderMode;
  range: DateRange;
  current: FunnelCounts;
  d7: { range: DateRange; counts: FunnelCounts } | null;
  d365: { range: DateRange; counts: FunnelCounts } | null;
}

export interface DailyTrendResponse {
  mode: ProviderMode;
  range: DateRange;
  comparisonMode: ComparisonMode;
  comparisonRange: DateRange | null;
  points: DailyTrendPoint[];
  comparisonPoints: DailyTrendPoint[] | null;
}

export interface BreakdownResponse {
  mode: ProviderMode;
  dimension: BreakdownDimension;
  comparisonMode: ComparisonMode;
  rows: BreakdownRow[];
}

export interface DataQualityResponse {
  mode: ProviderMode;
  checks: DataQualityCheckResult[];
}

export interface FilterOptionsResponse extends FilterOptions {
  mode: ProviderMode;
}
