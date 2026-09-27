import { describe, expect, it } from "vitest";
import { MockDataProvider } from "@/lib/data-providers/mock-provider";
import { buildCombos, comboMatchesFilters } from "@/lib/data-providers/synthetic";
import { sumCounts } from "@/lib/metrics";
import type { DashboardQuery } from "@/lib/types";

const provider = new MockDataProvider();
const DAY: DashboardQuery["range"] = { start: "2026-09-26", end: "2026-09-26" };

describe("comboMatchesFilters", () => {
  const combos = buildCombos();

  it("matches everything when no filters are set", () => {
    expect(combos.every((c) => comboMatchesFilters(c, {}))).toBe(true);
  });

  it("excludes combos outside a single-value filter", () => {
    const matches = combos.filter((c) => comboMatchesFilters(c, { ga4City: ["Gurgaon"] }));
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((c) => c.ga4City === "Gurgaon")).toBe(true);
  });

  it("OR-combines multiple values within the same filter dimension", () => {
    const matches = combos.filter((c) => comboMatchesFilters(c, { platform: ["Web", "iOS App"] }));
    expect(matches.every((c) => c.platform === "Web" || c.platform === "iOS App")).toBe(true);
    expect(matches.some((c) => c.platform === "Android App")).toBe(false);
  });

  it("AND-combines across different filter dimensions", () => {
    const matches = combos.filter((c) => comboMatchesFilters(c, { platform: ["Web"], device: ["mobile"] }));
    expect(matches.every((c) => c.platform === "Web" && c.device === "mobile")).toBe(true);
  });
});

describe("MockDataProvider.getFunnelCounts — filters actually narrow the data", () => {
  it("a single-city filter returns strictly fewer sessions than no filter", async () => {
    const total = await provider.getFunnelCounts({ range: DAY, filters: {} });
    const gurgaon = await provider.getFunnelCounts({ range: DAY, filters: { ga4City: ["Gurgaon"] } });
    expect(gurgaon.sessionStartUsers).toBeGreaterThan(0);
    expect(gurgaon.sessionStartUsers).toBeLessThan(total.sessionStartUsers);
  });

  it("filtering is a pure narrowing: city + platform is <= city alone", async () => {
    const cityOnly = await provider.getFunnelCounts({ range: DAY, filters: { ga4City: ["Delhi"] } });
    const cityAndPlatform = await provider.getFunnelCounts({
      range: DAY,
      filters: { ga4City: ["Delhi"], platform: ["Web"] },
    });
    expect(cityAndPlatform.sessionStartUsers).toBeLessThanOrEqual(cityOnly.sessionStartUsers);
  });

  it("an impossible filter combination (no matching combos) returns all-zero counts, not an error", async () => {
    // No combo has both India and a non-"Other" city crossed with a non-India country filter simultaneously —
    // exercise the empty-match path directly via a filter that matches nothing.
    const result = await provider.getFunnelCounts({
      range: DAY,
      filters: { country: ["India"], ga4City: ["Other"], platform: ["Web"], brand: ["Nonexistent Brand"] },
    });
    expect(result.sessionStartUsers).toBe(0);
    expect(result.purchaseUsers).toBe(0);
  });
});

describe("MockDataProvider.getBreakdown — city breakdown sums back to the unfiltered total", () => {
  it("summing every city's current counts reproduces the unfiltered total for that day", async () => {
    const total = await provider.getFunnelCounts({ range: DAY, filters: {} });
    const rows = await provider.getBreakdown({ range: DAY, filters: {} }, "ga4City", null);
    const resummed = sumCounts(rows.map((r) => r.current));
    expect(resummed.sessionStartUsers).toBe(total.sessionStartUsers);
    expect(resummed.purchaseUsers).toBe(total.purchaseUsers);
  });

  it("with a comparison query, every row carries both current and comparison ECR", async () => {
    const comparisonQuery: DashboardQuery = { range: { start: "2026-09-19", end: "2026-09-19" }, filters: {} };
    const rows = await provider.getBreakdown({ range: DAY, filters: {} }, "platform", comparisonQuery);
    rows.forEach((row) => {
      expect(row.shoppingEcr.currentValue).not.toBeNull();
      expect(row.shoppingEcr.comparisonValue).not.toBeNull();
    });
  });
});

describe("date range handling", () => {
  it("a 7-day range returns roughly 7x the single-day session volume (same order of magnitude, not identical)", async () => {
    const single = await provider.getFunnelCounts({ range: DAY, filters: {} });
    const week = await provider.getFunnelCounts({ range: { start: "2026-09-20", end: "2026-09-26" }, filters: {} });
    expect(week.sessionStartUsers).toBeGreaterThan(single.sessionStartUsers * 5);
    expect(week.sessionStartUsers).toBeLessThan(single.sessionStartUsers * 9);
  });
});
