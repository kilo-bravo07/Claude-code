"use client";

import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { FunnelKpiRow } from "@/components/FunnelKpiRow";
import { ShoppingFunnelViz } from "@/components/FunnelVisualization";
import { DailyTrendSection } from "@/components/DailyTrendSection";
import { DimensionBreakdownSection } from "@/components/DimensionBreakdownSection";
import { WhereDidEcrDrop } from "@/components/WhereDidEcrDrop";
import { LoadingPanel, ErrorPanel } from "@/components/StatePanels";
import { useFunnelCounts } from "@/hooks/useFunnelCounts";
import { useChangeUnit } from "@/hooks/useChangeUnit";
import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { getProperty } from "@/lib/properties";
import { FILTER_LABELS } from "@/lib/properties/types";

export default function ShoppingPage() {
  return (
    <Suspense fallback={<LoadingPanel label="Loading dashboard…" />}>
      <ShoppingContent />
    </Suspense>
  );
}

function ShoppingContent() {
  const funnelState = useFunnelCounts();
  const { unit } = useChangeUnit();
  const { property: propertyKey } = useDashboardFilters();
  const property = getProperty(propertyKey);
  const available = new Set(property.availableFilters);

  return (
    <div className="space-y-6">
      <FilterBar />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">Shopping KPIs</h2>
        {funnelState.status === "loading" && <LoadingPanel />}
        {funnelState.status === "error" && <ErrorPanel message={funnelState.error} />}
        {funnelState.status === "success" && (
          <FunnelKpiRow data={funnelState.data} property={property} funnel="shopping" unit={unit} />
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">Shopping funnel</h2>
        {funnelState.status === "success" && (
          <div className="rounded border border-ink-100 p-3">
            <ShoppingFunnelViz property={property} counts={funnelState.data.current} />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">Daily trend</h2>
        <DailyTrendSection funnel="shopping" />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {available.has("ga4City") && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">City breakdown ({FILTER_LABELS.ga4City})</h2>
            <DimensionBreakdownSection dimension="ga4City" dimensionLabel={FILTER_LABELS.ga4City} ecrKind="shoppingEcr" />
          </section>
        )}
        {available.has("country") && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">Country breakdown</h2>
            <DimensionBreakdownSection dimension="country" dimensionLabel="Country" ecrKind="shoppingEcr" />
          </section>
        )}
        {available.has("device") && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">Device breakdown</h2>
            <DimensionBreakdownSection dimension="device" dimensionLabel="Device" ecrKind="shoppingEcr" />
          </section>
        )}
      </div>

      <WhereDidEcrDrop ecrKind="shoppingEcr" title="Where did Shopping ECR drop?" />
    </div>
  );
}
