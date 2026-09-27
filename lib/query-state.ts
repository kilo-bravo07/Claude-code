import { parseFilters } from "./api-utils";
import { today } from "./date-utils";
import { DEFAULT_PROPERTY_KEY, isPropertyKey } from "./properties";
import type { FilterKey } from "./properties/types";
import type { ComparisonMode, DashboardQuery, DimensionFilters } from "./types";

export interface FilterState extends DashboardQuery {
  comparisonMode: ComparisonMode;
}

const FILTER_KEYS: FilterKey[] = ["device", "country", "ga4City", "trafficSource", "trafficMedium"];

/** Client-side counterpart to api-utils' parseQuery: never throws, defaults to "today" and the default property. */
export function parseFilterState(params: URLSearchParams): FilterState {
  const start = params.get("start") || today();
  const end = params.get("end") || start;
  const comparisonRaw = params.get("comparison");
  const comparisonMode: ComparisonMode =
    comparisonRaw === "d7" || comparisonRaw === "d365" || comparisonRaw === "none" ? comparisonRaw : "d7";
  const propertyRaw = params.get("property");
  const property = propertyRaw && isPropertyKey(propertyRaw) ? propertyRaw : DEFAULT_PROPERTY_KEY;
  return { property, range: { start, end }, filters: parseFilters(params), comparisonMode };
}

export function serializeFilterState(state: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  params.set("property", state.property);
  params.set("start", state.range.start);
  params.set("end", state.range.end);
  params.set("comparison", state.comparisonMode);
  FILTER_KEYS.forEach((key) => {
    const values = state.filters[key];
    if (values?.length) params.set(key, values.join(","));
  });
  return params;
}

export function toApiQueryString(state: FilterState): string {
  return serializeFilterState(state).toString();
}

export const FILTER_DIMENSION_KEYS = FILTER_KEYS;
