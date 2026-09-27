"use client";

import { useDailyTrend } from "@/hooks/useDailyTrend";
import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { comparisonLabel as comparisonLabelFor } from "@/lib/date-utils";
import { getProperty } from "@/lib/properties";
import { DailyTrendChart } from "./DailyTrendChart";
import { DailyComparisonTable } from "./DailyComparisonTable";
import { LoadingPanel, ErrorPanel, EmptyPanel } from "./StatePanels";

export function DailyTrendSection({ funnel }: { funnel: "shopping" | "checkout" }) {
  const { property: propertyKey, comparisonMode } = useDashboardFilters();
  const property = getProperty(propertyKey);
  const definition = funnel === "shopping" ? property.shopping : property.checkout;
  const state = useDailyTrend();

  if (state.status === "loading") return <LoadingPanel label="Loading daily trend…" />;
  if (state.status === "error") return <ErrorPanel message={state.error} />;
  if (state.data.points.length === 0) return <EmptyPanel />;

  const label = comparisonLabelFor(comparisonMode);

  return (
    <div className="space-y-3">
      <DailyTrendChart
        points={state.data.points}
        comparisonPoints={state.data.comparisonPoints}
        comparisonLabel={label}
        metricLabel={definition.ecr.label}
        metric={definition.ecr}
      />
      <DailyComparisonTable
        points={state.data.points}
        comparisonPoints={state.data.comparisonPoints}
        comparisonLabel={label}
        funnel={definition}
      />
    </div>
  );
}
