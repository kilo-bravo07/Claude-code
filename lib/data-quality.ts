/**
 * Modular data-quality checks (spec section 18). Generic across all four
 * properties: the caller (the data-quality API route) builds a
 * `QualitySignals` bag from whatever events/coverage the CURRENT property
 * actually declares, and hands it to `runDataQualityChecks`. Add a new check
 * by appending to `CHECKS` — nothing here is property-specific.
 */
import { DATA_QUALITY, OVER_100_PERCENT_WARNING } from "./config";
import type { DataQualityCheckResult } from "./types";

export interface OverHundredFinding {
  key: string;
  label: string;
  funnel: "shopping" | "checkout";
  rate: number;
}

export interface QualitySignals {
  /** One entry per event this property's funnels declare, keyed by stage key, e.g. { sessionStart: 10393, viewItem: 3617, ... }. */
  eventCounts: Record<string, number>;
  /** Human label per key, for readable messages. */
  eventLabels: Record<string, string>;
  /** Previous comparable period's event counts, for abnormal-drop detection. Optional. */
  priorEventCounts?: Record<string, number>;
  /** Share (0-1) of purchase events carrying an item_id. */
  itemIdCoverage: number;
  /** Share (0-1) of purchase events carrying an item_category. */
  itemCategoryCoverage: number;
  /** Share (0-1) of view/list events carrying an item_list_name. */
  itemListNameCoverage: number;
  /** Share (0-1) of this property's checkout-funnel stages that have at least one user in range. */
  checkoutEventCoverage: number;
  /** Only present when this property tracks purchase revenue. */
  revenue?: { purchases: number; revenue: number };
  /** Any funnel stage whose conversion computed >100% — never altered, only flagged. */
  over100: OverHundredFinding[];
}

type Check = (s: QualitySignals) => DataQualityCheckResult[];

const eventAvailabilityChecks: Check = (s) =>
  Object.entries(s.eventCounts).map(([key, count]) => {
    const label = s.eventLabels[key] ?? key;
    if (count <= 0 && DATA_QUALITY.zeroEventIsCritical) {
      return {
        id: `event_${key}`,
        label: `${label} availability`,
        severity: "critical",
        message: `No ${label} events in the selected range/filters. Possible tracking/data issue rather than a real business drop to zero.`,
        detail: { count },
      };
    }
    return { id: `event_${key}`, label: `${label} availability`, severity: "ok", message: `${label} events present.`, detail: { count } };
  });

const revenueCheck: Check = (s) => {
  if (!s.revenue) return [];
  if (s.revenue.purchases > 0 && s.revenue.revenue <= 0) {
    return [
      {
        id: "purchase_revenue",
        label: "purchase revenue availability",
        severity: "critical",
        message: "Purchases were recorded but revenue is 0. Revenue/value parameter may not be firing.",
        detail: { purchases: s.revenue.purchases, revenue: s.revenue.revenue },
      },
    ];
  }
  return [
    {
      id: "purchase_revenue",
      label: "purchase revenue availability",
      severity: "ok",
      message: "Purchase revenue present.",
      detail: { purchases: s.revenue.purchases, revenue: s.revenue.revenue },
    },
  ];
};

function coverageCheck(id: string, label: string, value: number): DataQualityCheckResult {
  if (value < DATA_QUALITY.minItemDimensionCoverage) {
    return {
      id,
      label,
      severity: value < DATA_QUALITY.minItemDimensionCoverage * 0.7 ? "critical" : "warning",
      message: `${label} is ${(value * 100).toFixed(1)}%, below the ${(
        DATA_QUALITY.minItemDimensionCoverage * 100
      ).toFixed(0)}% target. Breakdown by product/list may be unreliable.`,
      detail: { coverage: value },
    };
  }
  return { id, label, severity: "ok", message: `${label} is ${(value * 100).toFixed(1)}%.`, detail: { coverage: value } };
}

const coverageChecks: Check = (s) => [
  coverageCheck("item_id", "item_id coverage", s.itemIdCoverage),
  coverageCheck("item_category", "item_category coverage", s.itemCategoryCoverage),
  coverageCheck("item_list_name", "item_list_name coverage", s.itemListNameCoverage),
  coverageCheck("checkout_event_coverage", "checkout event coverage", s.checkoutEventCoverage),
];

const abnormalDropCheck: Check = (s) => {
  if (!s.priorEventCounts) {
    return [
      {
        id: "abnormal_drop",
        label: "abnormal event-volume drop",
        severity: "ok",
        message: "No prior period supplied for comparison.",
      },
    ];
  }
  const flagged: string[] = [];
  Object.keys(s.eventCounts).forEach((key) => {
    const prior = s.priorEventCounts![key] ?? 0;
    const curr = s.eventCounts[key];
    if (prior > 0 && curr <= prior * (1 - DATA_QUALITY.abnormalDropFraction)) {
      flagged.push(s.eventLabels[key] ?? key);
    }
  });
  if (flagged.length > 0) {
    return [
      {
        id: "abnormal_drop",
        label: "abnormal event-volume drop",
        severity: "warning",
        message: `${flagged.join(", ")} dropped more than ${Math.round(
          DATA_QUALITY.abnormalDropFraction * 100,
        )}% vs. the comparison period. Verify this is a real business change, not a tracking gap, before treating it as ECR deterioration.`,
        detail: { flagged: flagged.join(",") },
      },
    ];
  }
  return [{ id: "abnormal_drop", label: "abnormal event-volume drop", severity: "ok", message: "No abnormal event-volume drops detected." }];
};

const over100Check: Check = (s) => {
  if (s.over100.length === 0) {
    return [
      {
        id: "over_100_percent",
        label: "step conversion >100%",
        severity: "ok",
        message: "No funnel stage exceeded 100% conversion.",
      },
    ];
  }
  return s.over100.map((finding) => ({
    id: `over_100_percent_${finding.funnel}_${finding.key}`,
    label: `${finding.label} (${finding.funnel}) conversion >100%`,
    severity: "warning",
    message: OVER_100_PERCENT_WARNING,
    detail: { rate: finding.rate, funnel: finding.funnel },
  }));
};

const CHECKS: Check[] = [eventAvailabilityChecks, revenueCheck, coverageChecks, abnormalDropCheck, over100Check];

export function runDataQualityChecks(signals: QualitySignals): DataQualityCheckResult[] {
  return CHECKS.flatMap((check) => check(signals));
}
