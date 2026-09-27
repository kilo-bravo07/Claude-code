import { describe, expect, it } from "vitest";
import {
  classifySeverity,
  compareEcr,
  compareFunnels,
  compareRates,
  computeCheckoutEcr,
  computeCheckoutFunnel,
  computeOverallEcr,
  computeShoppingEcr,
  computeShoppingFunnel,
  emptyCounts,
  formatPercent,
  formatPp,
  formatRelative,
  rate,
  sumCounts,
} from "@/lib/metrics";
import type { FunnelCounts } from "@/lib/types";

function counts(overrides: Partial<FunnelCounts>): FunnelCounts {
  return { ...emptyCounts(), ...overrides };
}

describe("rate", () => {
  it("computes a percentage", () => {
    expect(rate(500, 10000)).toBeCloseTo(5);
  });
  it("returns null for a zero denominator", () => {
    expect(rate(10, 0)).toBeNull();
  });
  it("returns null for a negative denominator", () => {
    expect(rate(10, -5)).toBeNull();
  });
});

describe("computeShoppingFunnel — spec worked example", () => {
  // sessions=10000, view_item=3500, ATC=1300, begin_checkout=1200, purchase=500
  // => View Item 35%, ATC 37.14%, Checkout 92.31%, Purchase 41.67%, ECR 5%
  const c = counts({
    sessionStartUsers: 10000,
    viewItemUsers: 3500,
    addToCartUsers: 1300,
    beginCheckoutUsers: 1200,
    purchaseUsers: 500,
  });

  it("View Item % = View Item / Session Start", () => {
    const [viewItem] = computeShoppingFunnel(c);
    expect(viewItem.rate).toBeCloseTo(35, 5);
  });

  it("Add to Cart % = ATC / View Item", () => {
    const [, atc] = computeShoppingFunnel(c);
    expect(atc.rate).toBeCloseTo(37.142857, 4);
  });

  it("Checkout % = Begin Checkout / ATC", () => {
    const [, , checkout] = computeShoppingFunnel(c);
    expect(checkout.rate).toBeCloseTo(92.307692, 4);
  });

  it("Purchase % = Purchase / Begin Checkout", () => {
    const [, , , purchase] = computeShoppingFunnel(c);
    expect(purchase.rate).toBeCloseTo(41.666667, 4);
  });

  it("Shopping ECR = Purchase / Session Start", () => {
    expect(computeShoppingEcr(c)).toBeCloseTo(5, 5);
  });

  it("Overall ECR uses the same denominator as Shopping ECR (Session Start), never Add to Cart or Begin Checkout", () => {
    expect(computeOverallEcr(c)).toBe(computeShoppingEcr(c));
  });
});

describe("computeCheckoutFunnel", () => {
  const c = counts({
    beginCheckoutUsers: 1207,
    checkoutStep2Users: 962,
    checkoutStep3Users: 830,
    checkoutStep4Users: 814,
    checkoutStep5Users: 732,
    purchaseUsers: 566,
  });
  const stages = computeCheckoutFunnel(c);

  it("Step 2 = Step 2 / Begin Checkout", () => {
    expect(stages[0].rate).toBeCloseTo((962 / 1207) * 100, 5);
  });
  it("Step 3 = Step 3 / Step 2 (denominator is the previous step, not Begin Checkout)", () => {
    expect(stages[1].rate).toBeCloseTo((830 / 962) * 100, 5);
  });
  it("Step 4 = Step 4 / Step 3", () => {
    expect(stages[2].rate).toBeCloseTo((814 / 830) * 100, 5);
  });
  it("Step 5 = Step 5 / Step 4", () => {
    expect(stages[3].rate).toBeCloseTo((732 / 814) * 100, 5);
  });
  it("Purchase = Purchase / Step 5", () => {
    expect(stages[4].rate).toBeCloseTo((566 / 732) * 100, 5);
  });
  it("Checkout ECR = Purchase / Begin Checkout (not Purchase / Step 5)", () => {
    expect(computeCheckoutEcr(c)).toBeCloseTo((566 / 1207) * 100, 5);
    expect(computeCheckoutEcr(c)).not.toBeCloseTo(stages[4].rate!, 2);
  });
});

describe("zero/null handling", () => {
  it("a stage with a zero denominator reports null, not 0% or Infinity", () => {
    const c = counts({ sessionStartUsers: 0, viewItemUsers: 0 });
    const [viewItem] = computeShoppingFunnel(c);
    expect(viewItem.rate).toBeNull();
  });

  it("compareRates with a null comparison yields a null pp/relative change and STABLE severity", () => {
    const change = compareRates(42, null);
    expect(change.ppChange).toBeNull();
    expect(change.relativeChange).toBeNull();
    expect(change.severity).toBe("STABLE");
  });

  it("sumCounts of an empty list returns all-zero counts, not a crash", () => {
    expect(sumCounts([])).toEqual(emptyCounts());
  });
});

describe("pp vs relative change", () => {
  it("pp change is a plain subtraction of two already-percentage values", () => {
    const change = compareRates(46.89, 50.74);
    expect(change.ppChange).toBeCloseTo(-3.85, 5);
  });

  it("relative change is (current-comparison)/comparison, a fraction, distinct from pp change", () => {
    const change = compareRates(46.89, 50.74);
    expect(change.relativeChange).toBeCloseTo((46.89 - 50.74) / 50.74, 5);
    expect(change.relativeChange).not.toBeCloseTo(change.ppChange!, 2);
  });
});

describe("drop severity classification (config-driven thresholds)", () => {
  it("classifies >= +1pp as IMPROVED", () => {
    expect(classifySeverity(1.68)).toBe("IMPROVED");
    expect(classifySeverity(1)).toBe("IMPROVED");
  });
  it("classifies between -1pp and +1pp as STABLE", () => {
    expect(classifySeverity(0)).toBe("STABLE");
    expect(classifySeverity(0.99)).toBe("STABLE");
    expect(classifySeverity(-0.99)).toBe("STABLE");
  });
  it("classifies <= -1pp (but > -3pp) as DROP", () => {
    expect(classifySeverity(-1)).toBe("DROP");
    expect(classifySeverity(-2.99)).toBe("DROP");
  });
  it("classifies <= -3pp as MAJOR_DROP", () => {
    expect(classifySeverity(-3)).toBe("MAJOR_DROP");
    expect(classifySeverity(-3.85)).toBe("MAJOR_DROP");
  });
  it("treats a null change as STABLE (no fabricated severity when there is no comparison data)", () => {
    expect(classifySeverity(null)).toBe("STABLE");
  });
});

describe("compareFunnels / compareEcr wiring", () => {
  const current = counts({
    sessionStartUsers: 10393,
    viewItemUsers: 3617,
    addToCartUsers: 1309,
    beginCheckoutUsers: 1207,
    checkoutStep2Users: 962,
    checkoutStep3Users: 830,
    checkoutStep4Users: 814,
    checkoutStep5Users: 732,
    purchaseUsers: 566,
  });
  const priorWeek = counts({
    sessionStartUsers: 10265,
    viewItemUsers: 3483,
    addToCartUsers: 1202,
    beginCheckoutUsers: 1088,
    checkoutStep2Users: 877,
    checkoutStep3Users: 775,
    checkoutStep4Users: 758,
    checkoutStep5Users: 696,
    purchaseUsers: 552,
  });

  it("produces one comparison row per shopping funnel stage with matching keys", () => {
    const rows = compareFunnels(computeShoppingFunnel, current, priorWeek);
    expect(rows.map((r) => r.key)).toEqual(["viewItem", "addToCart", "checkout", "purchase"]);
    rows.forEach((row) => {
      expect(row.currentValue).not.toBeNull();
      expect(row.comparisonValue).not.toBeNull();
    });
  });

  it("compareEcr compares Shopping ECR current vs D-7", () => {
    const change = compareEcr(computeShoppingEcr, current, priorWeek);
    expect(change.currentValue).toBeCloseTo(computeShoppingEcr(current)!, 5);
    expect(change.comparisonValue).toBeCloseTo(computeShoppingEcr(priorWeek)!, 5);
  });

  it("a null comparison funnel (e.g. comparison mode = none) yields null comparison values throughout", () => {
    const rows = compareFunnels(computeCheckoutFunnel, current, null);
    rows.forEach((row) => expect(row.comparisonValue).toBeNull());
  });
});

describe("formatting helpers", () => {
  it("formatPercent renders 2 decimals with a % suffix, or an em dash for null", () => {
    expect(formatPercent(5.347)).toBe("5.35%");
    expect(formatPercent(null)).toBe("—");
  });
  it("formatPp always shows an explicit sign", () => {
    expect(formatPp(1.5)).toBe("+1.50 pp");
    expect(formatPp(-1.5)).toBe("-1.50 pp");
    expect(formatPp(0)).toBe("±0.00 pp");
  });
  it("formatRelative renders a signed percentage from a fraction", () => {
    expect(formatRelative(0.05)).toBe("+5.0%");
    expect(formatRelative(-0.1)).toBe("-10.0%");
  });
});
