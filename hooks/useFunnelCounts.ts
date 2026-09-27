"use client";

import { useDashboardFilters } from "./useDashboardFilters";
import { useApiData } from "./useApiData";
import { toApiQueryString } from "@/lib/query-state";
import type { FunnelCountsResponse } from "@/lib/api-types";

export function useFunnelCounts() {
  const filterState = useDashboardFilters();
  const qs = toApiQueryString(filterState);
  return useApiData<FunnelCountsResponse>(`/api/funnel-counts?${qs}`);
}
