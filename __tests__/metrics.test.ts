import { describe, expect, it } from "vitest";
import {
  classifySeverity,
  compareFunnels,
  compareMetric,
  compareRates,
  computeFunnel,
  computeMetric,
  emptyCounts,
  formatPercent,
  formatPp,
  formatRelative,
  rate,
  sumCounts,
} from "@/lib/metrics";
import type { RawCounts } from "@/lib/types";
import type { FunnelDefinition } from "@/lib/properties/types";

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
  it("is never capped at 100 — some properties' real methodology exceeds it", () => {
    expect(rate(1584, 1462)).toBeCloseTo(108.3447, 3);
  });
});

// A small synthetic 3-stage funnel (root -> a -> b -> c) used to test the
// generic engine in isolation, independent of any real property's shape.
const GENERIC_FUNNEL: FunnelDefinition = {
  root: { key: "root", label: "Root", ga4EventName: "root_event" },
  stages: [
    { key: "a", label: "A", ga4EventName: "a_event" },
    { key: "b", label: "B", ga4EventName: "b_event" },
    { key: "c", label: "C", ga4EventName: "c_event" },
  ],
  ecr: { key: "ecr", label: "ECR", numeratorKey: "c", denominatorKey: "root", description: "c / root" },
};

describe("computeFunnel — spec worked example (sessions=10000, view=3500, atc=1300, checkout=1200, purchase=500)", () => {
  const counts: RawCounts = { root: 10000, a: 3500, b: 1300, c: 500 };
  const stages = computeFunnel(GENERIC_FUNNEL, counts);

  it("stage A = A / root", () => {
    expect(stages[0].rate).toBeCloseTo(35, 5);
  });
  it("stage B = B / A (not B / root)", () => {
    expect(stages[1].rate).toBeCloseTo((1300 / 3500) * 100, 5);
  });
  it("stage C = C / B", () => {
    expect(stages[2].rate).toBeCloseTo((500 / 1300) * 100, 5);
  });
  it("ECR = C / root", () => {
    expect(computeMetric(GENERIC_FUNNEL.ecr, counts)).toBeCloseTo(5, 5);
  });
});

describe("zero/null handling", () => {
  it("a stage with a zero denominator reports null, not 0% or Infinity", () => {
    const stages = computeFunnel(GENERIC_FUNNEL, { root: 0, a: 0 });
    expect(stages[0].rate).toBeNull();
  });

  it("a missing key in RawCounts is treated as 0, not undefined/NaN", () => {
    const stages = computeFunnel(GENERIC_FUNNEL, { root: 100 });
    expect(stages[0].numeratorUsers).toBe(0);
    expect(stages[0].rate).toBe(0);
  });

  it("compareRates with a null comparison yields a null pp/relative change and STABLE severity", () => {
    const change = compareRates(42, null);
    expect(change.ppChange).toBeNull();
    expect(change.relativeChange).toBeNull();
    expect(change.severity).toBe("STABLE");
  });

  it("sumCounts of an empty list returns an empty bag, not a crash", () => {
    expect(sumCounts([])).toEqual(emptyCounts());
  });

  it("sumCounts unions keys across rows that don't all share the same shape", () => {
    expect(sumCounts([{ a: 1 }, { b: 2 }, { a: 3, b: 1 }])).toEqual({ a: 4, b: 3 });
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
  it("a >100% stage that improves further is still classified normally (severity math doesn't special-case >100%)", () => {
    expect(classifySeverity(5)).toBe("IMPROVED");
  });
});

describe("compareFunnels / compareMetric wiring", () => {
  const current: RawCounts = { root: 10393, a: 3617, b: 1309, c: 566 };
  const priorWeek: RawCounts = { root: 10265, a: 3483, b: 1202, c: 552 };

  it("produces one comparison row per stage with matching keys, in order", () => {
    const rows = compareFunnels(GENERIC_FUNNEL, current, priorWeek);
    expect(rows.map((r) => r.key)).toEqual(["a", "b", "c"]);
    rows.forEach((row) => {
      expect(row.currentValue).not.toBeNull();
      expect(row.comparisonValue).not.toBeNull();
    });
  });

  it("compareMetric compares the ECR metric current vs D-7", () => {
    const change = compareMetric(GENERIC_FUNNEL.ecr, current, priorWeek);
    expect(change.currentValue).toBeCloseTo(computeMetric(GENERIC_FUNNEL.ecr, current)!, 5);
    expect(change.comparisonValue).toBeCloseTo(computeMetric(GENERIC_FUNNEL.ecr, priorWeek)!, 5);
  });

  it("a null comparison funnel (e.g. comparison mode = none) yields null comparison values throughout", () => {
    const rows = compareFunnels(GENERIC_FUNNEL, current, null);
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
