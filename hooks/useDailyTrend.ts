"use client";

import { useDashboardFilters } from "./useDashboardFilters";
import { useApiData } from "./useApiData";
import { toApiQueryString } from "@/lib/query-state";
import type { DailyTrendResponse } from "@/lib/api-types";

export function useDailyTrend() {
  const filterState = useDashboardFilters();
  const qs = toApiQueryString(filterState);
  return useApiData<DailyTrendResponse>(`/api/daily-trend?${qs}`);
}
