import { describe, expect, it } from "vitest";
import { runDataQualityChecks, type QualitySignals } from "@/lib/data-quality";

function baseSignals(overrides: Partial<QualitySignals> = {}): QualitySignals {
  return {
    eventCounts: {
      sessionStart: 10000,
      viewItem: 3000,
      addToCart: 1200,
      beginCheckout: 1100,
      purchase: 500,
    },
    eventLabels: {
      sessionStart: "Session Start",
      viewItem: "View Item",
      addToCart: "Add to Cart",
      beginCheckout: "Begin Checkout",
      purchase: "Purchase",
    },
    itemIdCoverage: 0.97,
    itemCategoryCoverage: 0.95,
    itemListNameCoverage: 0.92,
    checkoutEventCoverage: 1,
    over100: [],
    ...overrides,
  };
}

describe("data quality — event availability (dynamic per-property event list)", () => {
  it("all healthy signals produce zero critical/warning checks", () => {
    const results = runDataQualityChecks(baseSignals());
    expect(results.every((r) => r.severity === "ok")).toBe(true);
  });

  it("flags a zeroed-out event as a critical possible tracking issue, not a silent 0%, using the property's own event key", () => {
    const results = runDataQualityChecks(baseSignals({ eventCounts: { ...baseSignals().eventCounts, beginCheckout: 0 } }));
    const check = results.find((r) => r.id === "event_beginCheckout")!;
    expect(check.severity).toBe("critical");
    expect(check.message).toMatch(/tracking\/data issue/i);
  });

  it("works for an arbitrary property-specific key (e.g. Bakingo App's checkoutInitiated), not just the four FlowerAura Web names", () => {
    const results = runDataQualityChecks(
      baseSignals({ eventCounts: { checkoutInitiated: 0 }, eventLabels: { checkoutInitiated: "Checkout Initiated" } }),
    );
    expect(results.find((r) => r.id === "event_checkoutInitiated")!.severity).toBe("critical");
  });
});

describe("data quality — purchase revenue (optional; only checked when a property tracks it)", () => {
  it("skips the check entirely when revenue isn't supplied", () => {
    const results = runDataQualityChecks(baseSignals());
    expect(results.some((r) => r.id === "purchase_revenue")).toBe(false);
  });

  it("flags purchases with zero revenue as critical when revenue IS tracked", () => {
    const results = runDataQualityChecks(baseSignals({ revenue: { purchases: 500, revenue: 0 } }));
    expect(results.find((r) => r.id === "purchase_revenue")!.severity).toBe("critical");
  });

  it("is ok when revenue is present alongside purchases", () => {
    const results = runDataQualityChecks(baseSignals({ revenue: { purchases: 500, revenue: 70000 } }));
    expect(results.find((r) => r.id === "purchase_revenue")!.severity).toBe("ok");
  });
});

describe("data quality — item dimension coverage thresholds", () => {
  it("coverage above the configured minimum is ok", () => {
    const results = runDataQualityChecks(baseSignals({ itemIdCoverage: 0.9 }));
    expect(results.find((r) => r.id === "item_id")!.severity).toBe("ok");
  });

  it("coverage below the configured minimum is at least a warning", () => {
    const results = runDataQualityChecks(baseSignals({ itemIdCoverage: 0.5 }));
    expect(["warning", "critical"]).toContain(results.find((r) => r.id === "item_id")!.severity);
  });

  it("severely degraded coverage escalates to critical, not just warning", () => {
    const results = runDataQualityChecks(baseSignals({ itemCategoryCoverage: 0.1 }));
    expect(results.find((r) => r.id === "item_category")!.severity).toBe("critical");
  });
});

describe("data quality — abnormal drop vs. real business movement", () => {
  it("no prior period supplied: reports ok rather than guessing", () => {
    const results = runDataQualityChecks(baseSignals());
    expect(results.find((r) => r.id === "abnormal_drop")!.severity).toBe("ok");
  });

  it("a large drop vs. the prior period is flagged as a warning to verify before trusting the ECR movement", () => {
    const prior = baseSignals().eventCounts;
    const results = runDataQualityChecks(baseSignals({ eventCounts: { ...prior, purchase: 50 }, priorEventCounts: prior }));
    const check = results.find((r) => r.id === "abnormal_drop")!;
    expect(check.severity).toBe("warning");
    expect(check.detail?.flagged).toContain("Purchase");
  });

  it("a small, normal fluctuation vs. the prior period is not flagged", () => {
    const prior = baseSignals().eventCounts;
    const results = runDataQualityChecks(baseSignals({ eventCounts: { ...prior, purchase: 480 }, priorEventCounts: prior }));
    expect(results.find((r) => r.id === "abnormal_drop")!.severity).toBe("ok");
  });
});

describe("data quality — conversion >100% (spec: Bakingo Web checkout Step 1)", () => {
  it("no over-100 findings reports a single ok check", () => {
    const results = runDataQualityChecks(baseSignals({ over100: [] }));
    expect(results.find((r) => r.id === "over_100_percent")!.severity).toBe("ok");
  });

  it("an over-100 finding is a warning with the exact required wording, never silently altering the value", () => {
    const results = runDataQualityChecks(
      baseSignals({ over100: [{ key: "step1", label: "Step 1", funnel: "checkout", rate: 108.34 }] }),
    );
    const check = results.find((r) => r.id === "over_100_percent_checkout_step1")!;
    expect(check.severity).toBe("warning");
    expect(check.message).toBe("Step conversion >100% — investigate event/user counting methodology.");
    expect(check.detail?.rate).toBe(108.34);
  });

  it("multiple over-100 findings each get their own check row", () => {
    const results = runDataQualityChecks(
      baseSignals({
        over100: [
          { key: "step1", label: "Step 1", funnel: "checkout", rate: 108.34 },
          { key: "step9", label: "Step 9", funnel: "shopping", rate: 101.2 },
        ],
      }),
    );
    expect(results.filter((r) => r.id.startsWith("over_100_percent_"))).toHaveLength(2);
  });
});
