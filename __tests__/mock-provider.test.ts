import { describe, expect, it } from "vitest";
import { MockDataProvider } from "@/lib/data-providers/mock-provider";
import { buildCombos, comboMatchesFilters } from "@/lib/data-providers/synthetic";
import { sumCounts } from "@/lib/metrics";
import { FLOWERAURA_WEB } from "@/lib/properties/floweraura-web";
import { BAKINGO_APP } from "@/lib/properties/bakingo-app";
import type { DashboardQuery } from "@/lib/types";

const provider = new MockDataProvider();
const DAY: DashboardQuery["range"] = { start: "2026-09-26", end: "2026-09-26" };

function query(overrides: Partial<DashboardQuery> = {}): DashboardQuery {
  return { property: FLOWERAURA_WEB.key, range: DAY, filters: {}, ...overrides };
}

describe("comboMatchesFilters (dimensions are now property-independent: country/city/device/source/medium only)", () => {
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
    const matches = combos.filter((c) => comboMatchesFilters(c, { device: ["desktop", "tablet"] }));
    expect(matches.every((c) => c.device === "desktop" || c.device === "tablet")).toBe(true);
    expect(matches.some((c) => c.device === "mobile")).toBe(false);
  });

  it("AND-combines across different filter dimensions", () => {
    const matches = combos.filter((c) => comboMatchesFilters(c, { country: ["India"], device: ["mobile"] }));
    expect(matches.every((c) => c.country === "India" && c.device === "mobile")).toBe(true);
  });
});

describe("MockDataProvider.getFunnelCounts — filters actually narrow the data", () => {
  it("a single-city filter returns strictly fewer sessions than no filter", async () => {
    const total = await provider.getFunnelCounts(FLOWERAURA_WEB, query());
    const gurgaon = await provider.getFunnelCounts(FLOWERAURA_WEB, query({ filters: { ga4City: ["Gurgaon"] } }));
    expect(gurgaon.sessionStart).toBeGreaterThan(0);
    expect(gurgaon.sessionStart).toBeLessThan(total.sessionStart);
  });

  it("filtering is a pure narrowing: city + device is <= city alone", async () => {
    const cityOnly = await provider.getFunnelCounts(FLOWERAURA_WEB, query({ filters: { ga4City: ["Delhi"] } }));
    const cityAndDevice = await provider.getFunnelCounts(
      FLOWERAURA_WEB,
      query({ filters: { ga4City: ["Delhi"], device: ["mobile"] } }),
    );
    expect(cityAndDevice.sessionStart).toBeLessThanOrEqual(cityOnly.sessionStart);
  });
});

describe("MockDataProvider is property-aware: different properties produce different raw-count shapes", () => {
  it("FlowerAura Web's counts are keyed by its own funnel (sessionStart/viewItem/addToCart/beginCheckout/purchase)", async () => {
    const counts = await provider.getFunnelCounts(FLOWERAURA_WEB, query());
    expect(counts).toHaveProperty("sessionStart");
    expect(counts).toHaveProperty("viewItem");
    expect(counts).toHaveProperty("addToCart");
    expect(counts).toHaveProperty("beginCheckout");
    expect(counts).toHaveProperty("purchase");
  });

  it("Bakingo App's counts are keyed by ITS funnel, including its independent checkout stream", async () => {
    const counts = await provider.getFunnelCounts(BAKINGO_APP, query({ property: BAKINGO_APP.key }));
    expect(counts).toHaveProperty("checkoutInitiated");
    expect(counts).toHaveProperty("shippingInfoAdded");
    expect(counts).toHaveProperty("payNowClicked");
    // Bakingo App's checkout root is not one of its own shopping-funnel keys.
    expect(counts).not.toHaveProperty("checkoutStep0");
  });

  it("switching property for the same date/filters yields materially different session volume (each property has its own baseline)", async () => {
    const faWeb = await provider.getFunnelCounts(FLOWERAURA_WEB, query());
    const bakingoApp = await provider.getFunnelCounts(BAKINGO_APP, query({ property: BAKINGO_APP.key }));
    expect(faWeb.sessionStart).not.toBe(bakingoApp.sessionStart);
  });
});

describe("MockDataProvider.getBreakdown — city breakdown sums back to the unfiltered total", () => {
  it("summing every city's current counts reproduces the unfiltered total for that day", async () => {
    const total = await provider.getFunnelCounts(FLOWERAURA_WEB, query());
    const rows = await provider.getBreakdown(FLOWERAURA_WEB, query(), "ga4City", null);
    const resummed = sumCounts(rows.map((r) => r.current));
    expect(resummed.sessionStart).toBe(total.sessionStart);
    expect(resummed.purchase).toBe(total.purchase);
  });

  it("with a comparison query, every row carries both current and comparison ECR", async () => {
    const comparisonQuery = query({ range: { start: "2026-09-19", end: "2026-09-19" } });
    const rows = await provider.getBreakdown(FLOWERAURA_WEB, query(), "device", comparisonQuery);
    rows.forEach((row) => {
      expect(row.shoppingEcr.currentValue).not.toBeNull();
      expect(row.shoppingEcr.comparisonValue).not.toBeNull();
    });
  });
});

describe("date range handling", () => {
  it("a 7-day range returns roughly 7x the single-day session volume (same order of magnitude, not identical)", async () => {
    const single = await provider.getFunnelCounts(FLOWERAURA_WEB, query());
    const week = await provider.getFunnelCounts(FLOWERAURA_WEB, query({ range: { start: "2026-09-20", end: "2026-09-26" } }));
    expect(week.sessionStart).toBeGreaterThan(single.sessionStart * 5);
    expect(week.sessionStart).toBeLessThan(single.sessionStart * 9);
  });
});

describe("data quality: >100% detection surfaces for Bakingo Web-shaped demo data when it occurs", () => {
  it("getDataQuality never throws and always returns the fixed set of check categories", async () => {
    const { BAKINGO_WEB } = await import("@/lib/properties/bakingo-web");
    const checks = await provider.getDataQuality(BAKINGO_WEB, query({ property: BAKINGO_WEB.key }));
    expect(checks.some((c) => c.id === "over_100_percent" || c.id.startsWith("over_100_percent_"))).toBe(true);
  });
});
