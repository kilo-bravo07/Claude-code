"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseFilterState, serializeFilterState, type FilterState } from "@/lib/query-state";
import type { ComparisonMode, DateRange, DimensionFilters } from "@/lib/types";

/**
 * Single source of truth for all global filters (spec section 8): backed by
 * the URL query string, so it survives navigation between Overview /
 * Shopping / Checkout and is shareable/bookmarkable. Every page reads the
 * same hook, so changing a filter on one page updates every section that
 * uses it, everywhere.
 */
export function useDashboardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo(() => parseFilterState(searchParams), [searchParams]);

  const push = useCallback(
    (next: FilterState) => {
      const params = serializeFilterState(next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  const setRange = useCallback((range: DateRange) => push({ ...state, range }), [push, state]);

  const setComparisonMode = useCallback(
    (comparisonMode: ComparisonMode) => push({ ...state, comparisonMode }),
    [push, state],
  );

  const setFilterValues = useCallback(
    (key: keyof DimensionFilters, values: string[]) =>
      push({ ...state, filters: { ...state.filters, [key]: values.length ? values : undefined } }),
    [push, state],
  );

  const resetFilters = useCallback(() => push({ ...state, filters: {} }), [push, state]);

  return { ...state, setRange, setComparisonMode, setFilterValues, resetFilters };
}
