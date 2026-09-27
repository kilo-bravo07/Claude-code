"use client";

import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { FunnelKpiRow } from "@/components/FunnelKpiRow";
import { CheckoutFunnelViz } from "@/components/FunnelVisualization";
import { DailyTrendSection } from "@/components/DailyTrendSection";
import { DimensionBreakdownSection } from "@/components/DimensionBreakdownSection";
import { WhereDidEcrDrop } from "@/components/WhereDidEcrDrop";
import { StepDropSummary } from "@/components/StepDropSummary";
import { LoadingPanel, ErrorPanel } from "@/components/StatePanels";
import { useFunnelCounts } from "@/hooks/useFunnelCounts";
import { useChangeUnit } from "@/hooks/useChangeUnit";
import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { computeCheckoutFunnel } from "@/lib/metrics";
import { buildStageCards } from "@/lib/view-model";
import { comparisonLabel } from "@/lib/date-utils";

export default function CheckoutPage() {
  return (
    <Suspense fallback={<LoadingPanel label="Loading dashboard…" />}>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const funnelState = useFunnelCounts();
  const { unit } = useChangeUnit();
  const { comparisonMode } = useDashboardFilters();

  return (
    <div className="space-y-6">
      <FilterBar />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">Checkout KPIs</h2>
        {funnelState.status === "loading" && <LoadingPanel />}
        {funnelState.status === "error" && <ErrorPanel message={funnelState.error} />}
        {funnelState.status === "success" && <FunnelKpiRow data={funnelState.data} funnel="checkout" unit={unit} />}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">Checkout funnel</h2>
        {funnelState.status === "success" && (
          <div className="rounded border border-ink-100 p-3">
            <CheckoutFunnelViz counts={funnelState.data.current} />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">Daily trend</h2>
        <DailyTrendSection funnel="checkout" />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">City breakdown (GA4 City)</h2>
          <DimensionBreakdownSection dimension="ga4City" dimensionLabel="GA4 City" ecrKind="checkoutEcr" />
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">Platform breakdown</h2>
          <DimensionBreakdownSection dimension="platform" dimensionLabel="Platform" ecrKind="checkoutEcr" />
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">Device breakdown</h2>
          <DimensionBreakdownSection dimension="device" dimensionLabel="Device" ecrKind="checkoutEcr" />
        </section>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">Which checkout step dropped?</h2>
        {funnelState.status === "success" && (
          <StepDropSummary
            stages={buildStageCards(
              computeCheckoutFunnel,
              funnelState.data.current,
              funnelState.data.d7?.counts ?? null,
              funnelState.data.d365?.counts ?? null,
            )}
            comparisonLabel={comparisonLabel(comparisonMode)}
          />
        )}
      </section>

      <WhereDidEcrDrop ecrKind="checkoutEcr" title="Where did Checkout ECR drop?" />
    </div>
  );
}
