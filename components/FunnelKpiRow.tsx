import {
  computeCheckoutEcr,
  computeCheckoutFunnel,
  computeShoppingEcr,
  computeShoppingFunnel,
} from "@/lib/metrics";
import { buildEcrCard, buildStageCards } from "@/lib/view-model";
import type { ChangeUnit } from "@/hooks/useChangeUnit";
import type { FunnelCountsResponse } from "@/lib/api-types";
import { KpiCard } from "./KpiCard";

interface Props {
  data: FunnelCountsResponse;
  funnel: "shopping" | "checkout";
  unit: ChangeUnit;
}

export function FunnelKpiRow({ data, funnel, unit }: Props) {
  const d7 = data.d7?.counts ?? null;
  const d365 = data.d365?.counts ?? null;

  const stageCards =
    funnel === "shopping"
      ? buildStageCards(computeShoppingFunnel, data.current, d7, d365)
      : buildStageCards(computeCheckoutFunnel, data.current, d7, d365);

  const ecrCard =
    funnel === "shopping"
      ? buildEcrCard(
          computeShoppingEcr,
          "ECR",
          data.current,
          d7,
          d365,
          data.current.purchaseUsers,
          data.current.sessionStartUsers,
        )
      : buildEcrCard(
          computeCheckoutEcr,
          "ECR",
          data.current,
          d7,
          d365,
          data.current.purchaseUsers,
          data.current.beginCheckoutUsers,
        );

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {stageCards.map((stage) => (
        <KpiCard key={stage.key} stage={stage} unit={unit} />
      ))}
      <KpiCard stage={ecrCard} unit={unit} />
    </div>
  );
}
