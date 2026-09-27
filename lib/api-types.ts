import type {
  BreakdownDimension,
  BreakdownRow,
  ComparisonMode,
  DailyTrendPoint,
  DataQualityCheckResult,
  DateRange,
  FilterOptions,
  RawCounts,
} from "./types";
import type { PropertyKey } from "./properties/types";

export type ProviderMode = "mock" | "ga4";

export interface FunnelCountsResponse {
  mode: ProviderMode;
  property: PropertyKey;
  range: DateRange;
  current: RawCounts;
  d7: { range: DateRange; counts: RawCounts } | null;
  d365: { range: DateRange; counts: RawCounts } | null;
}

export interface DailyTrendResponse {
  mode: ProviderMode;
  property: PropertyKey;
  range: DateRange;
  comparisonMode: ComparisonMode;
  comparisonRange: DateRange | null;
  points: DailyTrendPoint[];
  comparisonPoints: DailyTrendPoint[] | null;
}

export interface BreakdownResponse {
  mode: ProviderMode;
  property: PropertyKey;
  dimension: BreakdownDimension;
  comparisonMode: ComparisonMode;
  rows: BreakdownRow[];
}

export interface DataQualityResponse {
  mode: ProviderMode;
  property: PropertyKey;
  checks: DataQualityCheckResult[];
}

export interface FilterOptionsResponse extends FilterOptions {
  mode: ProviderMode;
  property: PropertyKey;
}
