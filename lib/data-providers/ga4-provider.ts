/**
 * Real GA4 Data API provider — generic across all four properties.
 *
 * This is the only file in the app that talks to Google Analytics. It
 * authenticates either as a service account (if GOOGLE_APPLICATION_CREDENTIALS
 * points at a key file that has been granted at least Viewer access on the
 * GA4 property) or, more commonly for a Viewer-only Google account, via a
 * user OAuth refresh token (GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN) —
 * see README.md "Connecting GA4" for exactly how to obtain each of these.
 * The same credentials are reused for all four properties; only the GA4
 * property ID differs (per property.ga4PropertyIdEnvVar).
 *
 * Every event name and funnel shape is read from the requested property's
 * config (lib/properties/*.ts) — nothing about a specific property's
 * funnel is hardcoded here.
 */
import { BetaAnalyticsDataClient, protos } from "@google-analytics/data";
import { OAuth2Client } from "google-auth-library";
import { enumerateDates } from "../date-utils";
import { runDataQualityChecks, type OverHundredFinding, type QualitySignals } from "../data-quality";
import { computeFunnel, compareMetric, emptyCounts } from "../metrics";
import type {
  BreakdownDimension,
  BreakdownRow,
  DailyTrendPoint,
  DashboardQuery,
  DataQualityCheckResult,
  DimensionFilters,
  FilterOptions,
  RawCounts,
} from "../types";
import type { PropertyConfig } from "../properties/types";
import type { DataProvider } from "./types";
import { ga4Auth, getPropertyId } from "./ga4-config";

type IRunReportRequest = protos.google.analytics.data.v1beta.IRunReportRequest;
type IFilterExpression = protos.google.analytics.data.v1beta.IFilterExpression;

const GA4_DIMENSION_NAME: Partial<Record<keyof DimensionFilters, string>> = {
  device: "deviceCategory",
  country: "country",
  ga4City: "city",
  trafficSource: "sessionSource",
  trafficMedium: "sessionMedium",
};

let cachedClient: BetaAnalyticsDataClient | null = null;

function getClient(): BetaAnalyticsDataClient {
  if (cachedClient) return cachedClient;

  if (ga4Auth.serviceAccountKeyFile) {
    cachedClient = new BetaAnalyticsDataClient({ keyFilename: ga4Auth.serviceAccountKeyFile });
    return cachedClient;
  }

  if (ga4Auth.oauthClientId && ga4Auth.oauthClientSecret && ga4Auth.oauthRefreshToken) {
    const oauth2Client = new OAuth2Client(ga4Auth.oauthClientId, ga4Auth.oauthClientSecret);
    oauth2Client.setCredentials({ refresh_token: ga4Auth.oauthRefreshToken });
    cachedClient = new BetaAnalyticsDataClient({ authClient: oauth2Client as never });
    return cachedClient;
  }

  throw new Error(
    "GA4 authentication is not configured. Set either GOOGLE_APPLICATION_CREDENTIALS (service account) or " +
      "GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET/GOOGLE_OAUTH_REFRESH_TOKEN (user OAuth). See README.md.",
  );
}

function requirePropertyId(property: PropertyConfig): string {
  const id = getPropertyId(property);
  if (!id) {
    throw new Error(
      `${property.displayName} has no GA4 property ID configured. Set ${property.ga4PropertyIdEnvVar} in .env.`,
    );
  }
  return id;
}

function dimensionFilterFor(filters: DimensionFilters, eventName: string | null): IFilterExpression | undefined {
  const expressions: IFilterExpression[] = [];
  if (eventName !== null) {
    expressions.push({ filter: { fieldName: "eventName", stringFilter: { value: eventName } } });
  }

  (Object.keys(GA4_DIMENSION_NAME) as (keyof DimensionFilters)[]).forEach((key) => {
    const values = filters[key];
    const ga4Name = GA4_DIMENSION_NAME[key];
    if (values?.length && ga4Name) {
      expressions.push({ filter: { fieldName: ga4Name, inListFilter: { values } } });
    }
  });

  if (expressions.length === 0) return undefined;
  return { andGroup: { expressions } };
}

function ga4OutputDimensionName(dimension: BreakdownDimension): string[] {
  switch (dimension) {
    case "ga4City":
      return ["city"];
    case "country":
      return ["country"];
    case "device":
      return ["deviceCategory"];
    case "trafficSourceMedium":
      return ["sessionSource", "sessionMedium"];
  }
}

interface EventReportRow {
  key: string;
  activeUsers: number;
}

async function runEventReport(
  propertyId: string,
  eventName: string | null,
  range: { start: string; end: string },
  filters: DimensionFilters,
  outputDimensions: string[],
): Promise<EventReportRow[]> {
  const client = getClient();
  const request: IRunReportRequest = {
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: range.start, endDate: range.end }],
    dimensions: outputDimensions.map((name) => ({ name })),
    metrics: [{ name: "activeUsers" }],
    dimensionFilter: dimensionFilterFor(filters, eventName),
    limit: 100000,
  };

  const [response] = await client.runReport(request);
  const rows = response.rows ?? [];

  return rows.map((row) => {
    const dimValues = (row.dimensionValues ?? []).map((d) => d.value ?? "(not set)");
    return { key: dimValues.join(" / "), activeUsers: Number(row.metricValues?.[0]?.value ?? 0) };
  });
}

/** Every distinct (key -> GA4 event name) this property's shopping+checkout funnels need, deduped by key (a key can be shared, e.g. a shopping stage that is also the checkout funnel's root). */
function funnelEventKeys(property: PropertyConfig): { key: string; eventName: string }[] {
  const map = new Map<string, string>();
  map.set(property.shopping.root.key, property.shopping.root.ga4EventName);
  property.shopping.stages.forEach((s) => map.set(s.key, s.ga4EventName));
  map.set(property.checkout.root.key, property.checkout.root.ga4EventName);
  property.checkout.stages.forEach((s) => map.set(s.key, s.ga4EventName));
  return Array.from(map, ([key, eventName]) => ({ key, eventName }));
}

async function fetchCountsByKey(
  property: PropertyConfig,
  range: { start: string; end: string },
  filters: DimensionFilters,
  outputDimensions: string[],
): Promise<Map<string, RawCounts>> {
  const propertyId = requirePropertyId(property);
  const byKey = new Map<string, RawCounts>();

  const jobs: { key: string; eventName: string | null }[] = [
    ...funnelEventKeys(property),
    ...property.extraMetrics.map((m) => ({ key: m.key, eventName: m.ga4EventName })),
  ];

  await Promise.all(
    jobs.map(async ({ key, eventName }) => {
      const rows = await runEventReport(propertyId, eventName, range, filters, outputDimensions);
      for (const row of rows) {
        const counts = byKey.get(row.key) ?? {};
        counts[key] = row.activeUsers;
        byKey.set(row.key, counts);
      }
    }),
  );

  return byKey;
}

function sumRawCounts(map: Map<string, RawCounts>): RawCounts {
  const total: RawCounts = {};
  for (const counts of map.values()) {
    for (const key of Object.keys(counts)) {
      total[key] = (total[key] ?? 0) + counts[key];
    }
  }
  return total;
}

async function itemDimensionCoverage(
  property: PropertyConfig,
  range: { start: string; end: string },
  filters: DimensionFilters,
  eventName: string,
  ga4Dimension: string,
): Promise<number> {
  const propertyId = requirePropertyId(property);
  const rows = await runEventReport(propertyId, eventName, range, filters, [ga4Dimension]);
  const total = rows.reduce((sum, r) => sum + r.activeUsers, 0);
  if (total === 0) return 1;
  const missing = rows
    .filter((r) => r.key === "(not set)" || r.key === "" || r.key.toLowerCase() === "(none)")
    .reduce((sum, r) => sum + r.activeUsers, 0);
  return 1 - missing / total;
}

function findOver100(property: PropertyConfig, counts: RawCounts): OverHundredFinding[] {
  const findings: OverHundredFinding[] = [];
  computeFunnel(property.shopping, counts).forEach((stage) => {
    if (stage.rate !== null && stage.rate > 100) findings.push({ key: stage.key, label: stage.label, funnel: "shopping", rate: stage.rate });
  });
  computeFunnel(property.checkout, counts).forEach((stage) => {
    if (stage.rate !== null && stage.rate > 100) findings.push({ key: stage.key, label: stage.label, funnel: "checkout", rate: stage.rate });
  });
  return findings;
}

export class Ga4DataProvider implements DataProvider {
  readonly mode = "ga4" as const;

  async getFunnelCounts(property: PropertyConfig, query: DashboardQuery): Promise<RawCounts> {
    const map = await fetchCountsByKey(property, query.range, query.filters, []);
    return map.get("") ?? sumRawCounts(map);
  }

  async getDailyTrend(property: PropertyConfig, query: DashboardQuery): Promise<DailyTrendPoint[]> {
    const map = await fetchCountsByKey(property, query.range, query.filters, ["date"]);
    const dates = enumerateDates(query.range);
    return dates.map((iso) => ({ date: iso, counts: map.get(iso.replace(/-/g, "")) ?? emptyCounts() }));
  }

  async getBreakdown(
    property: PropertyConfig,
    query: DashboardQuery,
    dimension: BreakdownDimension,
    comparison: DashboardQuery | null,
  ): Promise<BreakdownRow[]> {
    const outputDimensions = ga4OutputDimensionName(dimension);

    const currentMap = await fetchCountsByKey(property, query.range, query.filters, outputDimensions);
    const comparisonMap = comparison
      ? await fetchCountsByKey(property, comparison.range, comparison.filters, outputDimensions)
      : new Map<string, RawCounts>();

    const keys = new Set([...currentMap.keys(), ...comparisonMap.keys()]);
    const rows: BreakdownRow[] = [];
    for (const key of keys) {
      const current = currentMap.get(key) ?? emptyCounts();
      const comparisonCounts = comparisonMap.get(key) ?? emptyCounts();
      rows.push({
        dimensionValue: key || "(not set)",
        current,
        comparison: comparisonCounts,
        shoppingEcr: compareMetric(property.shopping.ecr, current, comparison ? comparisonCounts : null),
        checkoutEcr: compareMetric(property.checkout.ecr, current, comparison ? comparisonCounts : null),
      });
    }
    return rows;
  }

  async getDataQuality(property: PropertyConfig, query: DashboardQuery): Promise<DataQualityCheckResult[]> {
    const counts = await this.getFunnelCounts(property, query);

    const [itemIdCoverage, itemCategoryCoverage, itemListNameCoverage] = await Promise.all([
      itemDimensionCoverage(property, query.range, query.filters, property.checkout.stages.at(-1)?.ga4EventName ?? property.shopping.stages.at(-1)!.ga4EventName, "itemId"),
      itemDimensionCoverage(property, query.range, query.filters, property.checkout.stages.at(-1)?.ga4EventName ?? property.shopping.stages.at(-1)!.ga4EventName, "itemCategory"),
      itemDimensionCoverage(property, query.range, query.filters, property.shopping.stages[0].ga4EventName, "itemListName"),
    ]);

    const checkoutStagesWithData = property.checkout.stages.filter((s) => (counts[s.key] ?? 0) > 0).length;

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

    const signals: QualitySignals = {
      eventCounts,
      eventLabels,
      itemIdCoverage,
      itemCategoryCoverage,
      itemListNameCoverage,
      checkoutEventCoverage: property.checkout.stages.length > 0 ? checkoutStagesWithData / property.checkout.stages.length : 1,
      over100: findOver100(property, counts),
    };

    return runDataQualityChecks(signals);
  }

  async getFilterOptions(property: PropertyConfig): Promise<FilterOptions> {
    const propertyId = requirePropertyId(property);
    const client = getClient();
    const dims = ["deviceCategory", "country", "city", "sessionSource", "sessionMedium"];
    const request: IRunReportRequest = {
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: "90daysAgo", endDate: "today" }],
      dimensions: dims.map((name) => ({ name })),
      metrics: [{ name: "activeUsers" }],
      limit: 100000,
    };
    const [response] = await client.runReport(request);
    const rows = response.rows ?? [];

    const collect = (idx: number) => Array.from(new Set(rows.map((r) => r.dimensionValues?.[idx]?.value ?? "(not set)"))).sort();

    return {
      devices: collect(0),
      countries: collect(1),
      ga4Cities: collect(2),
      trafficSources: collect(3),
      trafficMediums: collect(4),
      dataRange: { start: "2015-08-14", end: new Date().toISOString().slice(0, 10) },
    };
  }
}

/** A minimal, cheap GA4 call used only to verify a property's credentials/property ID actually work — see /api/properties/[key]/test-connection. */
export async function testGa4Connection(property: PropertyConfig): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const propertyId = requirePropertyId(property);
    const client = getClient();
    await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: "yesterday", endDate: "today" }],
      metrics: [{ name: "activeUsers" }],
      limit: 1,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
