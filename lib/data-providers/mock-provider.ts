import { enumerateDates } from "../date-utils";
import { runDataQualityChecks, type QualitySignals } from "../data-quality";
import { emptyCounts, sumCounts, computeShoppingEcr, computeCheckoutEcr, compareEcr } from "../metrics";
import type {
  BreakdownDimension,
  BreakdownRow,
  DailyTrendPoint,
  DashboardQuery,
  DataQualityCheckResult,
  FilterOptions,
  FunnelCounts,
} from "../types";
import type { DataProvider } from "./types";
import { buildCombos, comboCounts, comboMatchesFilters, demoDataRange, type Combo } from "./synthetic";

function countsForQuery(query: DashboardQuery): FunnelCounts {
  const combos = buildCombos().filter((c) => comboMatchesFilters(c, query.filters));
  const dates = enumerateDates(query.range);
  const rows: FunnelCounts[] = [];
  for (const date of dates) {
    for (const combo of combos) {
      rows.push(comboCounts(combo, date));
    }
  }
  return sumCounts(rows.length ? rows : [emptyCounts()]);
}

function seededCoverage(seedParts: (string | number)[], base: number): number {
  // Deterministic demo coverage value so the Data Quality panel has
  // something real (if unremarkable) to surface, distinct from the ECR
  // "recent dip" story generated in synthetic.ts.
  const key = seedParts.join("|");
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const noise = ((h >>> 0) % 1000) / 1000 - 0.5;
  return Math.max(0, Math.min(1, base + noise * 0.06));
}

export class MockDataProvider implements DataProvider {
  readonly mode = "mock" as const;

  async getFunnelCounts(query: DashboardQuery): Promise<FunnelCounts> {
    return countsForQuery(query);
  }

  async getDailyTrend(query: DashboardQuery): Promise<DailyTrendPoint[]> {
    const combos = buildCombos().filter((c) => comboMatchesFilters(c, query.filters));
    const dates = enumerateDates(query.range);
    return dates.map((date) => ({
      date,
      counts: sumCounts(combos.length ? combos.map((c) => comboCounts(c, date)) : [emptyCounts()]),
    }));
  }

  async getBreakdown(
    query: DashboardQuery,
    dimension: BreakdownDimension,
    comparison: DashboardQuery | null,
  ): Promise<BreakdownRow[]> {
    const combos = buildCombos().filter((c) => comboMatchesFilters(c, query.filters));
    const groups = new Map<string, Combo[]>();
    for (const combo of combos) {
      const key = dimensionValue(combo, dimension);
      const list = groups.get(key) ?? [];
      list.push(combo);
      groups.set(key, list);
    }

    const currentDates = enumerateDates(query.range);
    const comparisonDates = comparison ? enumerateDates(comparison.range) : [];

    const rows: BreakdownRow[] = [];
    for (const [dimensionValueKey, comboList] of groups) {
      const current = sumCounts(
        currentDates.flatMap((date) => comboList.map((c) => comboCounts(c, date))),
      );
      const comparisonCounts = comparison
        ? sumCounts(comparisonDates.flatMap((date) => comboList.map((c) => comboCounts(c, date))))
        : emptyCounts();

      rows.push({
        dimensionValue: dimensionValueKey,
        current,
        comparison: comparisonCounts,
        shoppingEcr: compareEcr(computeShoppingEcr, current, comparison ? comparisonCounts : null),
        checkoutEcr: compareEcr(computeCheckoutEcr, current, comparison ? comparisonCounts : null),
      });
    }
    return rows;
  }

  async getDataQuality(query: DashboardQuery): Promise<DataQualityCheckResult[]> {
    const counts = countsForQuery(query);
    const rangeKey = `${query.range.start}_${query.range.end}`;

    const signals: QualitySignals = {
      eventCounts: {
        sessionStart: counts.sessionStartUsers,
        viewItem: counts.viewItemUsers,
        addToCart: counts.addToCartUsers,
        beginCheckout: counts.beginCheckoutUsers,
        purchase: counts.purchaseUsers,
        purchaseRevenue: counts.revenue,
      },
      itemIdCoverage: seededCoverage([rangeKey, "item_id"], 0.96),
      itemCategoryCoverage: seededCoverage([rangeKey, "item_category"], 0.94),
      itemListNameCoverage: seededCoverage([rangeKey, "item_list_name"], 0.9),
      checkoutEventCoverage:
        counts.beginCheckoutUsers > 0
          ? Math.min(
              1,
              (counts.checkoutStep2Users > 0 ? 0.25 : 0) +
                (counts.checkoutStep3Users > 0 ? 0.25 : 0) +
                (counts.checkoutStep4Users > 0 ? 0.25 : 0) +
                (counts.checkoutStep5Users > 0 ? 0.25 : 0),
            )
          : 1,
    };

    return runDataQualityChecks(signals);
  }

  async getFilterOptions(): Promise<FilterOptions> {
    const combos = buildCombos();
    const uniq = (values: string[]) => Array.from(new Set(values)).sort();
    return {
      brands: uniq(combos.map((c) => c.brand)),
      platforms: uniq(combos.map((c) => c.platform)),
      devices: uniq(combos.map((c) => c.device)),
      countries: uniq(combos.map((c) => c.country)),
      ga4Cities: uniq(combos.map((c) => c.ga4City)),
      trafficSources: uniq(combos.map((c) => c.trafficSource)),
      trafficMediums: uniq(combos.map((c) => c.trafficMedium)),
      dataRange: demoDataRange(),
    };
  }
}

function dimensionValue(combo: Combo, dimension: BreakdownDimension): string {
  switch (dimension) {
    case "ga4City":
      return combo.ga4City;
    case "country":
      return combo.country;
    case "platform":
      return combo.platform;
    case "device":
      return combo.device;
    case "brand":
      return combo.brand;
    case "trafficSourceMedium":
      return `${combo.trafficSource} / ${combo.trafficMedium}`;
  }
}
