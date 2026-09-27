/**
 * Central metrics/calculation layer. Every derived percentage or comparison
 * shown anywhere in the UI must be produced by a function in this file —
 * components must never recompute a formula themselves (spec section 15).
 */
import { SEVERITY_THRESHOLDS } from "./config";
import type {
  ChangeSeverity,
  FunnelCounts,
  FunnelStageComparison,
  FunnelStageResult,
  MetricChange,
} from "./types";

/** Safe percentage: numerator/denominator * 100, or null if denominator is 0 (avoids divide-by-zero and avoids implying 0%). */
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

/** Shopping funnel: Session Start -> View Item -> Add to Cart -> Begin Checkout -> Purchase. */
export function computeShoppingFunnel(counts: FunnelCounts): FunnelStageResult[] {
  return [
    {
      key: "viewItem",
      label: "View Item",
      numeratorUsers: counts.viewItemUsers,
      denominatorUsers: counts.sessionStartUsers,
      rate: rate(counts.viewItemUsers, counts.sessionStartUsers),
    },
    {
      key: "addToCart",
      label: "Add to Cart",
      numeratorUsers: counts.addToCartUsers,
      denominatorUsers: counts.viewItemUsers,
      rate: rate(counts.addToCartUsers, counts.viewItemUsers),
    },
    {
      key: "checkout",
      label: "Checkout",
      numeratorUsers: counts.beginCheckoutUsers,
      denominatorUsers: counts.addToCartUsers,
      rate: rate(counts.beginCheckoutUsers, counts.addToCartUsers),
    },
    {
      key: "purchase",
      label: "Purchase",
      numeratorUsers: counts.purchaseUsers,
      denominatorUsers: counts.beginCheckoutUsers,
      rate: rate(counts.purchaseUsers, counts.beginCheckoutUsers),
    },
  ];
}

/** Overall Shopping ECR = Purchase users / Session Start users. */
export function computeShoppingEcr(counts: FunnelCounts): number | null {
  return rate(counts.purchaseUsers, counts.sessionStartUsers);
}

/** Checkout funnel: Begin Checkout -> Step 2 -> Step 3 -> Step 4 -> Step 5 -> Purchase. */
export function computeCheckoutFunnel(counts: FunnelCounts): FunnelStageResult[] {
  return [
    {
      key: "step2",
      label: "Step 2",
      numeratorUsers: counts.checkoutStep2Users,
      denominatorUsers: counts.beginCheckoutUsers,
      rate: rate(counts.checkoutStep2Users, counts.beginCheckoutUsers),
    },
    {
      key: "step3",
      label: "Step 3",
      numeratorUsers: counts.checkoutStep3Users,
      denominatorUsers: counts.checkoutStep2Users,
      rate: rate(counts.checkoutStep3Users, counts.checkoutStep2Users),
    },
    {
      key: "step4",
      label: "Step 4",
      numeratorUsers: counts.checkoutStep4Users,
      denominatorUsers: counts.checkoutStep3Users,
      rate: rate(counts.checkoutStep4Users, counts.checkoutStep3Users),
    },
    {
      key: "step5",
      label: "Step 5",
      numeratorUsers: counts.checkoutStep5Users,
      denominatorUsers: counts.checkoutStep4Users,
      rate: rate(counts.checkoutStep5Users, counts.checkoutStep4Users),
    },
    {
      key: "purchase",
      label: "Purchase",
      numeratorUsers: counts.purchaseUsers,
      denominatorUsers: counts.checkoutStep5Users,
      rate: rate(counts.purchaseUsers, counts.checkoutStep5Users),
    },
  ];
}

/** Checkout ECR = Purchase users / Begin Checkout users. */
export function computeCheckoutEcr(counts: FunnelCounts): number | null {
  return rate(counts.purchaseUsers, counts.beginCheckoutUsers);
}

/** Overall ECR shown on the Overview page: Purchase users / Session Start users (same denominator as Shopping ECR). */
export function computeOverallEcr(counts: FunnelCounts): number | null {
  return computeShoppingEcr(counts);
}

/** Merges current + comparison funnel counts into one row per stage, with pp/relative change and severity. */
export function compareFunnels(
  computeFn: (c: FunnelCounts) => FunnelStageResult[],
  current: FunnelCounts,
  comparison: FunnelCounts | null,
): FunnelStageComparison[] {
  const currentStages = computeFn(current);
  const comparisonStages = comparison ? computeFn(comparison) : null;
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

export function compareEcr(
  ecrFn: (c: FunnelCounts) => number | null,
  current: FunnelCounts,
  comparison: FunnelCounts | null,
): MetricChange {
  return compareRates(ecrFn(current), comparison ? ecrFn(comparison) : null);
}

export function sumCounts(rows: FunnelCounts[]): FunnelCounts {
  return rows.reduce<FunnelCounts>(
    (acc, r) => ({
      sessionStartUsers: acc.sessionStartUsers + r.sessionStartUsers,
      viewItemUsers: acc.viewItemUsers + r.viewItemUsers,
      addToCartUsers: acc.addToCartUsers + r.addToCartUsers,
      beginCheckoutUsers: acc.beginCheckoutUsers + r.beginCheckoutUsers,
      checkoutStep2Users: acc.checkoutStep2Users + r.checkoutStep2Users,
      checkoutStep3Users: acc.checkoutStep3Users + r.checkoutStep3Users,
      checkoutStep4Users: acc.checkoutStep4Users + r.checkoutStep4Users,
      checkoutStep5Users: acc.checkoutStep5Users + r.checkoutStep5Users,
      purchaseUsers: acc.purchaseUsers + r.purchaseUsers,
      revenue: acc.revenue + r.revenue,
      transactions: acc.transactions + r.transactions,
    }),
    emptyCounts(),
  );
}

export function emptyCounts(): FunnelCounts {
  return {
    sessionStartUsers: 0,
    viewItemUsers: 0,
    addToCartUsers: 0,
    beginCheckoutUsers: 0,
    checkoutStep2Users: 0,
    checkoutStep3Users: 0,
    checkoutStep4Users: 0,
    checkoutStep5Users: 0,
    purchaseUsers: 0,
    revenue: 0,
    transactions: 0,
  };
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
