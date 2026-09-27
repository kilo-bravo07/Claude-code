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
      purchaseRevenue: 700000,
    },
    itemIdCoverage: 0.97,
    itemCategoryCoverage: 0.95,
    itemListNameCoverage: 0.92,
    checkoutEventCoverage: 1,
    ...overrides,
  };
}

describe("data quality — event availability", () => {
  it("all healthy signals produce zero critical/warning checks", () => {
    const results = runDataQualityChecks(baseSignals());
    expect(results.every((r) => r.severity === "ok")).toBe(true);
  });

  it("flags a zeroed-out event as a critical possible tracking issue, not a silent 0%", () => {
    const results = runDataQualityChecks(baseSignals({ eventCounts: { ...baseSignals().eventCounts, beginCheckout: 0 } }));
    const check = results.find((r) => r.id === "begin_checkout")!;
    expect(check.severity).toBe("critical");
    expect(check.message).toMatch(/tracking\/data issue/i);
  });

  it("flags purchases with zero revenue as critical (revenue param likely not firing)", () => {
    const results = runDataQualityChecks(baseSignals({ eventCounts: { ...baseSignals().eventCounts, purchaseRevenue: 0 } }));
    const check = results.find((r) => r.id === "purchase_revenue")!;
    expect(check.severity).toBe("critical");
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
    const results = runDataQualityChecks(
      baseSignals({ eventCounts: { ...prior, purchase: 50 }, priorEventCounts: prior }),
    );
    const check = results.find((r) => r.id === "abnormal_drop")!;
    expect(check.severity).toBe("warning");
    expect(check.detail?.flagged).toContain("purchase");
  });

  it("a small, normal fluctuation vs. the prior period is not flagged", () => {
    const prior = baseSignals().eventCounts;
    const results = runDataQualityChecks(
      baseSignals({ eventCounts: { ...prior, purchase: 480 }, priorEventCounts: prior }),
    );
    expect(results.find((r) => r.id === "abnormal_drop")!.severity).toBe("ok");
  });
});
