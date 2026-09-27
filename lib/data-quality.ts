/**
 * Modular data-quality checks (spec section 12). Both the mock and GA4
 * providers compute the same `QualitySignals` shape from their own source
 * and hand it to `runDataQualityChecks`, so a new check is added once here
 * and applies to both providers. Add new checks by appending to `CHECKS`.
 */
import { DATA_QUALITY } from "./config";
import type { DataQualityCheckResult } from "./types";

export interface QualitySignals {
  eventCounts: {
    sessionStart: number;
    viewItem: number;
    addToCart: number;
    beginCheckout: number;
    purchase: number;
    purchaseRevenue: number;
  };
  /** Previous comparable period's event counts, for abnormal-drop detection. Optional. */
  priorEventCounts?: QualitySignals["eventCounts"];
  /** Share (0-1) of purchase events carrying an item_id. */
  itemIdCoverage: number;
  /** Share (0-1) of purchase events carrying an item_category. */
  itemCategoryCoverage: number;
  /** Share (0-1) of view_item/add_to_cart events carrying an item_list_name. */
  itemListNameCoverage: number;
  /** Share (0-1) of begin_checkout sessions that also produced at least one later checkout-step event. */
  checkoutEventCoverage: number;
}

type Check = (s: QualitySignals) => DataQualityCheckResult;

function eventAvailabilityCheck(id: string, label: string, key: keyof QualitySignals["eventCounts"]): Check {
  return (s) => {
    const count = s.eventCounts[key];
    if (count <= 0 && DATA_QUALITY.zeroEventIsCritical) {
      return {
        id,
        label,
        severity: "critical",
        message: `No ${label} events in the selected range/filters. Possible tracking/data issue rather than a real business drop to zero.`,
        detail: { count },
      };
    }
    return { id, label, severity: "ok", message: `${label} events present.`, detail: { count } };
  };
}

const CHECKS: Check[] = [
  eventAvailabilityCheck("session_start", "session_start availability", "sessionStart"),
  eventAvailabilityCheck("view_item", "view_item availability", "viewItem"),
  eventAvailabilityCheck("add_to_cart", "add_to_cart availability", "addToCart"),
  eventAvailabilityCheck("begin_checkout", "begin_checkout availability", "beginCheckout"),
  eventAvailabilityCheck("purchase", "purchase availability", "purchase"),

  (s) => {
    if (s.eventCounts.purchase > 0 && s.eventCounts.purchaseRevenue <= 0) {
      return {
        id: "purchase_revenue",
        label: "purchase revenue availability",
        severity: "critical",
        message: "Purchases were recorded but revenue is 0. Revenue/value parameter may not be firing.",
        detail: { purchases: s.eventCounts.purchase, revenue: s.eventCounts.purchaseRevenue },
      };
    }
    return {
      id: "purchase_revenue",
      label: "purchase revenue availability",
      severity: "ok",
      message: "Purchase revenue present.",
      detail: { purchases: s.eventCounts.purchase, revenue: s.eventCounts.purchaseRevenue },
    };
  },

  coverageCheck("item_id", "item_id coverage", (s) => s.itemIdCoverage),
  coverageCheck("item_category", "item_category coverage", (s) => s.itemCategoryCoverage),
  coverageCheck("item_list_name", "item_list_name coverage", (s) => s.itemListNameCoverage),
  coverageCheck("checkout_event_coverage", "checkout event coverage", (s) => s.checkoutEventCoverage),

  (s) => {
    if (!s.priorEventCounts) {
      return {
        id: "abnormal_drop",
        label: "abnormal event-volume drop",
        severity: "ok",
        message: "No prior period supplied for comparison.",
      };
    }
    const flagged: string[] = [];
    (Object.keys(s.eventCounts) as (keyof QualitySignals["eventCounts"])[]).forEach((key) => {
      const prior = s.priorEventCounts![key];
      const curr = s.eventCounts[key];
      if (prior > 0 && curr <= prior * (1 - DATA_QUALITY.abnormalDropFraction)) {
        flagged.push(key);
      }
    });
    if (flagged.length > 0) {
      return {
        id: "abnormal_drop",
        label: "abnormal event-volume drop",
        severity: "warning",
        message: `${flagged.join(", ")} dropped more than ${Math.round(
          DATA_QUALITY.abnormalDropFraction * 100,
        )}% vs. the comparison period. Verify this is a real business change, not a tracking gap, before treating it as ECR deterioration.`,
        detail: { flagged: flagged.join(",") },
      };
    }
    return {
      id: "abnormal_drop",
      label: "abnormal event-volume drop",
      severity: "ok",
      message: "No abnormal event-volume drops detected.",
    };
  },
];

function coverageCheck(id: string, label: string, getter: (s: QualitySignals) => number): Check {
  return (s) => {
    const value = getter(s);
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
  };
}

export function runDataQualityChecks(signals: QualitySignals): DataQualityCheckResult[] {
  return CHECKS.map((check) => check(signals));
}
