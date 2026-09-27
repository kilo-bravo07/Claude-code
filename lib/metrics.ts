/**
 * Central metrics/calculation layer. Every derived percentage or comparison
 * shown anywhere in the UI must be produced by a function in this file —
 * components must never recompute a formula themselves (spec section 15 of
 * the original brief, still true here).
 *
 * This layer is property-agnostic: it takes a FunnelDefinition/MetricDefinition
 * (from lib/properties/*.ts) plus a RawCounts bag and computes stage rates
 * generically. Rates are intentionally NEVER capped at 100% — some properties
 * (e.g. Bakingo Web) have real reporting quirks that produce >100% step
 * conversions, and the job of this layer is to report the number the
 * configured methodology actually produces, not to "fix" it. See
 * lib/data-quality.ts for the corresponding >100% warning.
 */
import { SEVERITY_THRESHOLDS } from "./config";
import type { FunnelDefinition, MetricDefinition } from "./properties/types";
import type { ChangeSeverity, FunnelStageComparison, FunnelStageResult, MetricChange, RawCounts } from "./types";

export function countOf(counts: RawCounts, key: string): number {
  return counts[key] ?? 0;
}

/** Safe percentage: numerator/denominator * 100, or null if denominator is 0 (avoids divide-by-zero and avoids implying 0%). Not capped — see file header. */
export function rate(numerator: number, denominator: number): number | null {
  if (!denominator || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

export function classifySeverity(ppChange: number | null): ChangeSeverity {
  if (ppChange === null) return "STABLE";
  if (ppChange <= SEVERITY_THRESHOLDS.majorDropPp) return "MAJOR_DROP";
  if (ppChange <= SEVERITY_THRESHOLDS.dropPp) return "DROP";
  if (ppChange >= SEVERITY_THRESHOLDS.improvedPp) return "IMPROVED";
  return "STABLE";
}

/**
 * Compares a current rate against a comparison-period rate.
 * ppChange is expressed in percentage points (both inputs are already 0-100 rates).
 * relativeChange is a fraction, e.g. 0.05 = +5% relative growth.
 */
export function compareRates(current: number | null, comparison: number | null): MetricChange {
  const ppChange = current !== null && comparison !== null ? current - comparison : null;
  const relativeChange =
    current !== null && comparison !== null && comparison !== 0
      ? (current - comparison) / comparison
      : null;
  return {
    currentValue: current,
    comparisonValue: comparison,
    ppChange,
    relativeChange,
    severity: classifySeverity(ppChange),
  };
}

/**
 * Computes every stage's rate for a funnel, generically. Stage 0's
 * denominator is the funnel's root; stage i>0's denominator is stage i-1's
 * count. This is the ONE place that walks a funnel definition — components
 * never re-implement "divide by the previous stage".
 */
export function computeFunnel(funnel: FunnelDefinition, counts: RawCounts): FunnelStageResult[] {
  return funnel.stages.map((stage, i) => {
    const denominatorKey = i === 0 ? funnel.root.key : funnel.stages[i - 1].key;
    const numeratorUsers = countOf(counts, stage.key);
    const denominatorUsers = countOf(counts, denominatorKey);
    return {
      key: stage.key,
      label: stage.label,
      numeratorUsers,
      denominatorUsers,
      rate: rate(numeratorUsers, denominatorUsers),
    };
  });
}

export function computeMetric(metric: MetricDefinition, counts: RawCounts): number | null {
  return rate(countOf(counts, metric.numeratorKey), countOf(counts, metric.denominatorKey));
}

/** Merges current + comparison funnel counts into one row per stage, with pp/relative change and severity. */
export function compareFunnels(
  funnel: FunnelDefinition,
  current: RawCounts,
  comparison: RawCounts | null,
): FunnelStageComparison[] {
  const currentStages = computeFunnel(funnel, current);
  const comparisonStages = comparison ? computeFunnel(funnel, comparison) : null;
  return currentStages.map((stage, i) => {
    const compStage = comparisonStages?.[i] ?? null;
    const change = compareRates(stage.rate, compStage?.rate ?? null);
    return {
      ...change,
      key: stage.key,
      label: stage.label,
      currentNumeratorUsers: stage.numeratorUsers,
      currentDenominatorUsers: stage.denominatorUsers,
    };
  });
}

export function compareMetric(
  metric: MetricDefinition,
  current: RawCounts,
  comparison: RawCounts | null,
): MetricChange {
  return compareRates(computeMetric(metric, current), comparison ? computeMetric(metric, comparison) : null);
}

export function sumCounts(rows: RawCounts[]): RawCounts {
  const total: RawCounts = {};
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      total[key] = (total[key] ?? 0) + row[key];
    }
  }
  return total;
}

export function emptyCounts(): RawCounts {
  return {};
}

export function formatPercent(value: number | null, digits = 2): string {
  if (value === null) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatPp(value: number | null, digits = 2): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "" : "±";
  return `${sign}${value.toFixed(digits)} pp`;
}

export function formatRelative(value: number | null, digits = 1): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "" : "±";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}
