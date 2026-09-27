import { enumerateDates } from "../date-utils";
import { runDataQualityChecks, type OverHundredFinding, type QualitySignals } from "../data-quality";
import { computeFunnel, compareMetric, emptyCounts, sumCounts } from "../metrics";
import type {
  BreakdownDimension,
  BreakdownRow,
  DailyTrendPoint,
  DashboardQuery,
  DataQualityCheckResult,
  FilterOptions,
  RawCounts,
} from "../types";
import type { PropertyConfig } from "../properties/types";
import type { DataProvider } from "./types";
import { buildCombos, comboCounts, comboMatchesFilters, demoDataRange, type Combo } from "./synthetic";

function countsForQuery(property: PropertyConfig, query: DashboardQuery): RawCounts {
  const combos = buildCombos().filter((c) => comboMatchesFilters(c, query.filters));
  const dates = enumerateDates(query.range);
  const rows: RawCounts[] = [];
  for (const date of dates) {
    for (const combo of combos) {
      rows.push(comboCounts(property, combo, date));
    }
  }
  return sumCounts(rows.length ? rows : [emptyCounts()]);
}

function seededCoverage(seedParts: (string | number)[], base: number): number {
  const key = seedParts.join("|");
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const noise = ((h >>> 0) % 1000) / 1000 - 0.5;
  return Math.max(0, Math.min(1, base + noise * 0.06));
}

function dimensionValue(combo: Combo, dimension: BreakdownDimension): string {
  switch (dimension) {
    case "ga4City":
      return combo.ga4City;
    case "country":
      return combo.country;
    case "device":
      return combo.device;
    case "trafficSourceMedium":
      return `${combo.trafficSource} / ${combo.trafficMedium}`;
  }
}

function findOver100(property: PropertyConfig, counts: RawCounts): OverHundredFinding[] {
  const findings: OverHundredFinding[] = [];
  computeFunnel(property.shopping, counts).forEach((stage) => {
    if (stage.rate !== null && stage.rate > 100) {
      findings.push({ key: stage.key, label: stage.label, funnel: "shopping", rate: stage.rate });
    }
  });
  computeFunnel(property.checkout, counts).forEach((stage) => {
    if (stage.rate !== null && stage.rate > 100) {
      findings.push({ key: stage.key, label: stage.label, funnel: "checkout", rate: stage.rate });
    }
  });
  return findings;
}

export class MockDataProvider implements DataProvider {
  readonly mode = "mock" as const;

  async getFunnelCounts(property: PropertyConfig, query: DashboardQuery): Promise<RawCounts> {
    return countsForQuery(property, query);
  }

  async getDailyTrend(property: PropertyConfig, query: DashboardQuery): Promise<DailyTrendPoint[]> {
    const combos = buildCombos().filter((c) => comboMatchesFilters(c, query.filters));
    const dates = enumerateDates(query.range);
    return dates.map((date) => ({
      date,
      counts: sumCounts(combos.length ? combos.map((c) => comboCounts(property, c, date)) : [emptyCounts()]),
    }));
  }

  async getBreakdown(
    property: PropertyConfig,
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
      const current = sumCounts(currentDates.flatMap((date) => comboList.map((c) => comboCounts(property, c, date))));
      const comparisonCounts = comparison
        ? sumCounts(comparisonDates.flatMap((date) => comboList.map((c) => comboCounts(property, c, date))))
        : emptyCounts();

      rows.push({
        dimensionValue: dimensionValueKey,
        current,
        comparison: comparisonCounts,
        shoppingEcr: compareMetric(property.shopping.ecr, current, comparison ? comparisonCounts : null),
        checkoutEcr: compareMetric(property.checkout.ecr, current, comparison ? comparisonCounts : null),
      });
    }
    return rows;
  }

  async getDataQuality(property: PropertyConfig, query: DashboardQuery): Promise<DataQualityCheckResult[]> {
    const counts = countsForQuery(property, query);
    const rangeKey = `${property.key}:${query.range.start}_${query.range.end}`;

    const eventCounts: Record<string, number> = {};
    const eventLabels: Record<string, string> = {};
    const track = (key: string, label: string) => {
      eventCounts[key] = counts[key] ?? 0;
      eventLabels[key] = label;
    };
    track(property.shopping.root.key, property.shopping.root.label);
    property.shopping.stages.forEach((s) => track(s.key, s.label));
    track(property.checkout.root.key, property.checkout.root.label);
    property.checkout.stages.forEach((s) => track(s.key, s.label));

    const checkoutStagesWithData = property.checkout.stages.filter((s) => (counts[s.key] ?? 0) > 0).length;

    const signals: QualitySignals = {
      eventCounts,
      eventLabels,
      itemIdCoverage: seededCoverage([rangeKey, "item_id"], 0.96),
      itemCategoryCoverage: seededCoverage([rangeKey, "item_category"], 0.94),
      itemListNameCoverage: seededCoverage([rangeKey, "item_list_name"], 0.9),
      checkoutEventCoverage: property.checkout.stages.length > 0 ? checkoutStagesWithData / property.checkout.stages.length : 1,
      over100: findOver100(property, counts),
    };

    return runDataQualityChecks(signals);
  }

  async getFilterOptions(property: PropertyConfig): Promise<FilterOptions> {
    const combos = buildCombos();
    const uniq = (values: string[]) => Array.from(new Set(values)).sort();
    void property;
    return {
      devices: uniq(combos.map((c) => c.device)),
      countries: uniq(combos.map((c) => c.country)),
      ga4Cities: uniq(combos.map((c) => c.ga4City)),
      trafficSources: uniq(combos.map((c) => c.trafficSource)),
      trafficMediums: uniq(combos.map((c) => c.trafficMedium)),
      dataRange: demoDataRange(),
    };
  }
}
