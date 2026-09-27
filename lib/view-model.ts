/**
 * Assembles the current + D-7 + D-365 comparisons a KPI card needs from
 * three FunnelCounts snapshots. Pure presentation glue over lib/metrics.ts —
 * still no formulas live here, just wiring.
 */
import { compareRates } from "./metrics";
import type { FunnelCounts, FunnelStageResult, MetricChange } from "./types";

export interface StageCardModel {
  key: string;
  label: string;
  rate: number | null;
  numeratorUsers: number;
  denominatorUsers: number;
  vsD7: MetricChange;
  vsD365: MetricChange;
}

export function buildStageCards(
  computeFn: (c: FunnelCounts) => FunnelStageResult[],
  current: FunnelCounts,
  d7: FunnelCounts | null,
  d365: FunnelCounts | null,
): StageCardModel[] {
  const currentStages = computeFn(current);
  const d7Stages = d7 ? computeFn(d7) : null;
  const d365Stages = d365 ? computeFn(d365) : null;

  return currentStages.map((stage, i) => ({
    key: stage.key,
    label: stage.label,
    rate: stage.rate,
    numeratorUsers: stage.numeratorUsers,
    denominatorUsers: stage.denominatorUsers,
    vsD7: compareRates(stage.rate, d7Stages?.[i]?.rate ?? null),
    vsD365: compareRates(stage.rate, d365Stages?.[i]?.rate ?? null),
  }));
}

export function buildEcrCard(
  ecrFn: (c: FunnelCounts) => number | null,
  label: string,
  current: FunnelCounts,
  d7: FunnelCounts | null,
  d365: FunnelCounts | null,
  numeratorUsers: number,
  denominatorUsers: number,
): StageCardModel {
  const rate = ecrFn(current);
  return {
    key: "ecr",
    label,
    rate,
    numeratorUsers,
    denominatorUsers,
    vsD7: compareRates(rate, d7 ? ecrFn(d7) : null),
    vsD365: compareRates(rate, d365 ? ecrFn(d365) : null),
  };
}
