"use client";

import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { useChangeUnit } from "@/hooks/useChangeUnit";
import { useApiData } from "@/hooks/useApiData";
import { toApiQueryString } from "@/lib/query-state";
import { comparisonLabel as comparisonLabelFor } from "@/lib/date-utils";
import type { BreakdownResponse } from "@/lib/api-types";
import type { BreakdownDimension } from "@/lib/types";
import { BreakdownTable } from "./BreakdownTable";
import { LoadingPanel, ErrorPanel } from "./StatePanels";

interface Props {
  dimension: BreakdownDimension;
  dimensionLabel: string;
  ecrKind: "shoppingEcr" | "checkoutEcr";
  sortByDeterioration?: boolean;
  limit?: number;
}

export function DimensionBreakdownSection({ dimension, dimensionLabel, ecrKind, sortByDeterioration, limit }: Props) {
  const filterState = useDashboardFilters();
  const { unit } = useChangeUnit();
  const qs = toApiQueryString(filterState);
  const state = useApiData<BreakdownResponse>(`/api/breakdown?dimension=${dimension}&${qs}`);

  if (state.status === "loading") return <LoadingPanel />;
  if (state.status === "error") return <ErrorPanel message={state.error} />;

  return (
    <BreakdownTable
      rows={state.data.rows}
      ecrKind={ecrKind}
      unit={unit}
      comparisonLabel={comparisonLabelFor(filterState.comparisonMode)}
      sortByDeterioration={sortByDeterioration}
      limit={limit}
      dimensionLabel={dimensionLabel}
    />
  );
}
