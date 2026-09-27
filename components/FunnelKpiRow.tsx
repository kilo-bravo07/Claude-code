import { buildMetricCard, buildStageCards } from "@/lib/view-model";
import type { ChangeUnit } from "@/hooks/useChangeUnit";
import type { FunnelCountsResponse } from "@/lib/api-types";
import type { PropertyConfig } from "@/lib/properties/types";
import { KpiCard } from "./KpiCard";

interface Props {
  data: FunnelCountsResponse;
  property: PropertyConfig;
  funnel: "shopping" | "checkout";
  unit: ChangeUnit;
}

/** Renders whatever stages + metrics the CURRENT property declares (spec section 9/10/21) — never a fixed 4/5-card layout. */
export function FunnelKpiRow({ data, property, funnel, unit }: Props) {
  const d7 = data.d7?.counts ?? null;
  const d365 = data.d365?.counts ?? null;
  const definition = funnel === "shopping" ? property.shopping : property.checkout;

  const stageCards = buildStageCards(definition, data.current, d7, d365);
  const ecrCard = buildMetricCard(definition.ecr, data.current, d7, d365);
  // Additional metrics (e.g. FlowerAura App's "New ECR") only ever apply to the shopping funnel today.
  const additionalCards =
    funnel === "shopping" ? property.additionalMetrics.map((m) => buildMetricCard(m, data.current, d7, d365)) : [];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {stageCards.map((stage) => (
        <KpiCard key={stage.key} stage={stage} unit={unit} />
      ))}
      <KpiCard stage={ecrCard} unit={unit} />
      {additionalCards.map((card) => (
        <KpiCard key={card.key} stage={card} unit={unit} />
      ))}
    </div>
  );
}
