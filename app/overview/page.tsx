"use client";

import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { FunnelKpiRow } from "@/components/FunnelKpiRow";
import { WhereDidEcrDrop } from "@/components/WhereDidEcrDrop";
import { DailyTrendSection } from "@/components/DailyTrendSection";
import { DataQualityPanel } from "@/components/DataQualityPanel";
import { LoadingPanel, ErrorPanel } from "@/components/StatePanels";
import { useFunnelCounts } from "@/hooks/useFunnelCounts";
import { useChangeUnit } from "@/hooks/useChangeUnit";
import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { getProperty } from "@/lib/properties";

export default function OverviewPage() {
  return (
    <Suspense fallback={<LoadingPanel label="Loading dashboard…" />}>
      <OverviewContent />
    </Suspense>
  );
}

function OverviewContent() {
  const funnelState = useFunnelCounts();
  const { unit } = useChangeUnit();
  const { property: propertyKey } = useDashboardFilters();
  const property = getProperty(propertyKey);

  return (
    <div className="space-y-6">
      <FilterBar />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">Shopping ECR</h2>
        {funnelState.status === "loading" && <LoadingPanel label="Loading shopping funnel…" />}
        {funnelState.status === "error" && <ErrorPanel message={funnelState.error} />}
        {funnelState.status === "success" && (
          <FunnelKpiRow data={funnelState.data} property={property} funnel="shopping" unit={unit} />
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">Checkout ECR</h2>
        {funnelState.status === "loading" && <LoadingPanel label="Loading checkout funnel…" />}
        {funnelState.status === "error" && <ErrorPanel message={funnelState.error} />}
        {funnelState.status === "success" && (
          <FunnelKpiRow data={funnelState.data} property={property} funnel="checkout" unit={unit} />
        )}
      </section>

      <WhereDidEcrDrop ecrKind="shoppingEcr" />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">Daily ECR trend</h2>
        <DailyTrendSection funnel="shopping" />
      </section>

      <DataQualityPanel />
    </div>
  );
}
