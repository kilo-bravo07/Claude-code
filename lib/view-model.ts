/**
 * Assembles the current + D-7 + D-365 comparisons a KPI card needs from
 * three RawCounts snapshots. Pure presentation glue over lib/metrics.ts —
 * still no formulas live here, just wiring.
 */
import { compareRates, computeFunnel, computeMetric } from "./metrics";
import type { FunnelDefinition, MetricDefinition } from "./properties/types";
import type { MetricChange, RawCounts } from "./types";

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
  funnel: FunnelDefinition,
  current: RawCounts,
  d7: RawCounts | null,
  d365: RawCounts | null,
): StageCardModel[] {
  const currentStages = computeFunnel(funnel, current);
  const d7Stages = d7 ? computeFunnel(funnel, d7) : null;
  const d365Stages = d365 ? computeFunnel(funnel, d365) : null;

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

export function buildMetricCard(
  metric: MetricDefinition,
  current: RawCounts,
  d7: RawCounts | null,
  d365: RawCounts | null,
): StageCardModel {
  const rateValue = computeMetric(metric, current);
  return {
    key: metric.key,
    label: metric.label,
    rate: rateValue,
    numeratorUsers: current[metric.numeratorKey] ?? 0,
    denominatorUsers: current[metric.denominatorKey] ?? 0,
    vsD7: compareRates(rateValue, d7 ? computeMetric(metric, d7) : null),
    vsD365: compareRates(rateValue, d365 ? computeMetric(metric, d365) : null),
  };
}
