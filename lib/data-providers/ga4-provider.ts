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
 *
 * IMPORTANT — request volume: every call to the GA4 Data API goes through
 * runReportQueued() below, which caps how many requests are in flight at
 * once and retries transient RESOURCE_EXHAUSTED (quota) errors with
 * backoff. This app also fetches all of a property's funnel events in ONE
 * request (dimensioning by "eventName" instead of firing one filtered
 * request per event) — a naive one-request-per-event design very quickly
 * exceeds GA4's concurrent-request quota once several dashboard sections
 * load at once. Keep both of these when touching this file.
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
import type { FunnelDefinition, Ga4FilterCondition, PropertyConfig } from "../properties/types";
import type { DataProvider } from "./types";
import { ga4Auth, getPropertyId } from "./ga4-config";

type IRunReportRequest = protos.google.analytics.data.v1beta.IRunReportRequest;
type IRunReportResponse = protos.google.analytics.data.v1beta.IRunReportResponse;
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

// ── concurrency-limited, retrying GA4 request queue ─────────────────────
// GA4's Data API enforces a per-property concurrent-request quota that a
// dashboard with several panels can easily exceed if every panel fires its
// own requests the moment it mounts. Every runReport call in this file goes
// through this queue instead of calling the client directly.
const MAX_CONCURRENT_GA4_REQUESTS = 4;
let activeGa4Requests = 0;
const ga4Queue: (() => void)[] = [];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function acquireGa4Slot(): Promise<void> {
  if (activeGa4Requests < MAX_CONCURRENT_GA4_REQUESTS) {
    activeGa4Requests++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    ga4Queue.push(() => {
      activeGa4Requests++;
      resolve();
    });
  });
}

function releaseGa4Slot(): void {
  activeGa4Requests--;
  const next = ga4Queue.shift();
  if (next) next();
}

function isResourceExhausted(err: unknown): boolean {
  const code = (err as { code?: number })?.code;
  const message = err instanceof Error ? err.message : String(err);
  return code === 8 || message.includes("RESOURCE_EXHAUSTED");
}

async function runReportQueued(request: IRunReportRequest): Promise<IRunReportResponse> {
  await acquireGa4Slot();
  try {
    const client = getClient();
    let attempt = 0;
    // Retry only the specific transient "too many requests right now" case —
    // any other error (bad property ID, auth failure, invalid dimension)
    // surfaces immediately.
    while (true) {
      try {
        const [response] = await client.runReport(request);
        return response;
      } catch (err) {
        attempt++;
        if (attempt <= 3 && isResourceExhausted(err)) {
          await sleep(500 * attempt);
          continue;
        }
        throw err;
      }
    }
  } finally {
    releaseGa4Slot();
  }
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

function dimensionFilterFor(filters: DimensionFilters): IFilterExpression | undefined {
  const expressions: IFilterExpression[] = [];

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

const MATCH_TYPE: Record<Ga4FilterCondition["match"], string> = {
  full_regexp: "FULL_REGEXP",
  partial_regexp: "PARTIAL_REGEXP",
  contains: "CONTAINS",
};

/** Turns a property's own declared filter conditions (e.g. "exclude blog landing pages") into GA4 filter expressions, exactly reproducing that property's existing GA4 reporting segment rather than approximating it. */
function baseFilterExpressions(conditions: Ga4FilterCondition[] | undefined): IFilterExpression[] {
  if (!conditions?.length) return [];
  return conditions.map((condition) => {
    const expr: IFilterExpression = {
      filter: {
        fieldName: condition.dimension,
        stringFilter: {
          matchType: MATCH_TYPE[condition.match] as never,
          value: condition.value,
          caseSensitive: false,
        },
      },
    };
    return condition.negate ? { notExpression: expr } : expr;
  });
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

/** The (key -> GA4 event name) map for one funnel only, deduped by key. */
function funnelEventNameMap(funnel: FunnelDefinition): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (key: string, eventName: string) => {
    const keys = map.get(eventName) ?? [];
    keys.push(key);
    map.set(eventName, keys);
  };
  add(funnel.root.key, funnel.root.ga4EventName);
  funnel.stages.forEach((s) => add(s.key, s.ga4EventName));
  return map;
}

/**
 * Fetches one funnel's stage counts in a SINGLE GA4 request (by
 * dimensioning on "eventName" rather than issuing one request per event —
 * see the file header) with that funnel's own baseFilters applied. Shopping
 * and checkout are always fetched separately (never combined into one
 * request) because a property's two funnels can declare different GA4
 * filter conditions — e.g. FlowerAura Web's checkout funnel excludes a
 * narrower set of campaigns than its shopping funnel — so their event
 * counts are not guaranteed to be reproducible from a shared query.
 */
async function fetchFunnelSlice(
  propertyId: string,
  funnel: FunnelDefinition,
  range: { start: string; end: string },
  filters: DimensionFilters,
  outputDimensions: string[],
): Promise<Map<string, RawCounts>> {
  const eventNameToKeys = funnelEventNameMap(funnel);
  const byKey = new Map<string, RawCounts>();
  const eventNames = Array.from(eventNameToKeys.keys());
  if (eventNames.length === 0) return byKey;

  const expressions: IFilterExpression[] = [
    { filter: { fieldName: "eventName", inListFilter: { values: eventNames } } },
    ...baseFilterExpressions(funnel.baseFilters),
  ];
  const userFilter = dimensionFilterFor(filters);
  if (userFilter) expressions.push(userFilter);

  const response = await runReportQueued({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: range.start, endDate: range.end }],
    dimensions: ["eventName", ...outputDimensions].map((name) => ({ name })),
    metrics: [{ name: "activeUsers" }],
    dimensionFilter: { andGroup: { expressions } },
    limit: 100000,
  });

  for (const row of response.rows ?? []) {
    const values = (row.dimensionValues ?? []).map((d) => d.value ?? "(not set)");
    const [eventName, ...rest] = values;
    const keys = eventNameToKeys.get(eventName);
    if (!keys) continue; // shouldn't happen given the inList filter, but be defensive
    const restKey = rest.join(" / ");
    const activeUsers = Number(row.metricValues?.[0]?.value ?? 0);
    const counts = byKey.get(restKey) ?? {};
    keys.forEach((key) => (counts[key] = activeUsers));
    byKey.set(restKey, counts);
  }

  return byKey;
}

function mergeRawCountsMaps(maps: Map<string, RawCounts>[]): Map<string, RawCounts> {
  const merged = new Map<string, RawCounts>();
  for (const map of maps) {
    for (const [key, counts] of map) {
      merged.set(key, { ...(merged.get(key) ?? {}), ...counts });
    }
  }
  return merged;
}

/** Fetches every funnel-stage count this property needs for one date range/filter/breakdown combination (shopping + checkout, each as their own request/filters — see fetchFunnelSlice), plus extraMetrics (e.g. FlowerAura App's ActiveUsers) if declared. */
async function fetchCountsByKey(
  property: PropertyConfig,
  range: { start: string; end: string },
  filters: DimensionFilters,
  outputDimensions: string[],
): Promise<Map<string, RawCounts>> {
  const propertyId = requirePropertyId(property);

  const [shoppingMap, checkoutMap] = await Promise.all([
    fetchFunnelSlice(propertyId, property.shopping, range, filters, outputDimensions),
    fetchFunnelSlice(propertyId, property.checkout, range, filters, outputDimensions),
  ]);

  const maps = [shoppingMap, checkoutMap];

  if (property.extraMetrics.length > 0) {
    const extraResponse = await runReportQueued({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: range.start, endDate: range.end }],
      dimensions: outputDimensions.map((name) => ({ name })),
      metrics: [{ name: "activeUsers" }],
      dimensionFilter: dimensionFilterFor(filters),
      limit: 100000,
    });
    const extraMap = new Map<string, RawCounts>();
    for (const row of extraResponse.rows ?? []) {
      const restKey = (row.dimensionValues ?? []).map((d) => d.value ?? "(not set)").join(" / ");
      const activeUsers = Number(row.metricValues?.[0]?.value ?? 0);
      const counts: RawCounts = {};
      property.extraMetrics.forEach((m) => (counts[m.key] = activeUsers));
      extraMap.set(restKey, counts);
    }
    maps.push(extraMap);
  }

  return mergeRawCountsMaps(maps);
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
  funnelBaseFilters: Ga4FilterCondition[] | undefined,
): Promise<number> {
  const propertyId = requirePropertyId(property);
  const filterExpressions: IFilterExpression[] = [
    { filter: { fieldName: "eventName", stringFilter: { value: eventName } } },
    ...baseFilterExpressions(funnelBaseFilters),
  ];
  const baseFilter = dimensionFilterFor(filters);
  if (baseFilter) filterExpressions.push(baseFilter);

  const response = await runReportQueued({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: range.start, endDate: range.end }],
    dimensions: [{ name: ga4Dimension }],
    metrics: [{ name: "activeUsers" }],
    dimensionFilter: { andGroup: { expressions: filterExpressions } },
    limit: 100000,
  });

  const rows = (response.rows ?? []).map((row) => ({
    key: row.dimensionValues?.[0]?.value ?? "(not set)",
    activeUsers: Number(row.metricValues?.[0]?.value ?? 0),
  }));
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
    const checkoutLastStage = property.checkout.stages.at(-1);
    const purchaseLikeEvent = checkoutLastStage?.ga4EventName ?? property.shopping.stages.at(-1)!.ga4EventName;
    const purchaseLikeBaseFilters = checkoutLastStage ? property.checkout.baseFilters : property.shopping.baseFilters;

    const itemIdCoverage = await itemDimensionCoverage(
      property,
      query.range,
      query.filters,
      purchaseLikeEvent,
      "itemId",
      purchaseLikeBaseFilters,
    );
    const itemCategoryCoverage = await itemDimensionCoverage(
      property,
      query.range,
      query.filters,
      purchaseLikeEvent,
      "itemCategory",
      purchaseLikeBaseFilters,
    );
    const itemListNameCoverage = await itemDimensionCoverage(
      property,
      query.range,
      query.filters,
      property.shopping.stages[0].ga4EventName,
      "itemListName",
      property.shopping.baseFilters,
    );

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
    const dims = ["deviceCategory", "country", "city", "sessionSource", "sessionMedium"];
    const response = await runReportQueued({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: "90daysAgo", endDate: "today" }],
      dimensions: dims.map((name) => ({ name })),
      metrics: [{ name: "activeUsers" }],
      limit: 100000,
    });
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
    await runReportQueued({
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
