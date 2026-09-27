/**
 * Real GA4 Data API provider.
 *
 * This is the only file in the app that talks to Google Analytics. It
 * authenticates either as a service account (if GOOGLE_APPLICATION_CREDENTIALS
 * points at a key file that has been granted at least Viewer access on the
 * GA4 property) or, more commonly for a Viewer-only Google account, via a
 * user OAuth refresh token (GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN) —
 * see README.md "Connecting GA4" for exactly how to obtain each of these.
 *
 * GA4's standard ecommerce events cover session_start / view_item /
 * add_to_cart / begin_checkout / purchase, but the 4-step checkout progress
 * (Step 2..Step 5) in the source Google Sheet is a custom implementation
 * specific to this site. The event names for every stage are therefore
 * configurable via env vars (see ga4-config.ts) rather than hardcoded —
 * update them to match whatever your GTM/gtag implementation actually fires.
 */
import { BetaAnalyticsDataClient, protos } from "@google-analytics/data";
import { OAuth2Client } from "google-auth-library";
import { enumerateDates } from "../date-utils";
import { runDataQualityChecks, type QualitySignals } from "../data-quality";
import { emptyCounts, computeShoppingEcr, computeCheckoutEcr, compareEcr } from "../metrics";
import type {
  BreakdownDimension,
  BreakdownRow,
  DailyTrendPoint,
  DashboardQuery,
  DataQualityCheckResult,
  DimensionFilters,
  FilterOptions,
  FunnelCounts,
} from "../types";
import type { DataProvider } from "./types";
import { ga4Config } from "./ga4-config";

type IRunReportRequest = protos.google.analytics.data.v1beta.IRunReportRequest;
type IFilterExpression = protos.google.analytics.data.v1beta.IFilterExpression;

const GA4_DIMENSION_NAME: Partial<Record<keyof DimensionFilters, string>> = {
  platform: "platform",
  device: "deviceCategory",
  country: "country",
  ga4City: "city",
  trafficSource: "sessionSource",
  trafficMedium: "sessionMedium",
};

let cachedClient: BetaAnalyticsDataClient | null = null;

function getClient(): BetaAnalyticsDataClient {
  if (cachedClient) return cachedClient;

  if (ga4Config.auth.serviceAccountKeyFile) {
    cachedClient = new BetaAnalyticsDataClient({ keyFilename: ga4Config.auth.serviceAccountKeyFile });
    return cachedClient;
  }

  if (ga4Config.auth.oauthClientId && ga4Config.auth.oauthClientSecret && ga4Config.auth.oauthRefreshToken) {
    const oauth2Client = new OAuth2Client(ga4Config.auth.oauthClientId, ga4Config.auth.oauthClientSecret);
    oauth2Client.setCredentials({ refresh_token: ga4Config.auth.oauthRefreshToken });
    // google-gax accepts a pre-authenticated google-auth-library client via `authClient`.
    cachedClient = new BetaAnalyticsDataClient({ authClient: oauth2Client as never });
    return cachedClient;
  }

  throw new Error(
    "GA4 is not configured. Set GA4_PROPERTY_ID plus either GOOGLE_APPLICATION_CREDENTIALS (service account) " +
      "or GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET/GOOGLE_OAUTH_REFRESH_TOKEN (user OAuth). See README.md.",
  );
}

function dimensionFilterFor(filters: DimensionFilters, eventName: string): IFilterExpression {
  const expressions: IFilterExpression[] = [
    { filter: { fieldName: "eventName", stringFilter: { value: eventName } } },
  ];

  (Object.keys(GA4_DIMENSION_NAME) as (keyof DimensionFilters)[]).forEach((key) => {
    const values = filters[key];
    const ga4Name = GA4_DIMENSION_NAME[key];
    if (values?.length && ga4Name) {
      expressions.push({
        filter: { fieldName: ga4Name, inListFilter: { values } },
      });
    }
  });

  if (filters.brand?.length && ga4Config.brandDimension) {
    expressions.push({
      filter: { fieldName: ga4Config.brandDimension, inListFilter: { values: filters.brand } },
    });
  }

  return { andGroup: { expressions } };
}

function ga4OutputDimensionName(dimension: BreakdownDimension): string[] {
  switch (dimension) {
    case "ga4City":
      return ["city"];
    case "country":
      return ["country"];
    case "platform":
      return ["platform"];
    case "device":
      return ["deviceCategory"];
    case "brand":
      return ga4Config.brandDimension ? [ga4Config.brandDimension] : [];
    case "trafficSourceMedium":
      return ["sessionSource", "sessionMedium"];
  }
}

interface EventReportOptions {
  eventName: string;
  range: { start: string; end: string };
  filters: DimensionFilters;
  outputDimensions: string[]; // raw GA4 dimension names, [] for a single aggregate row
  includeRevenue?: boolean;
}

interface EventReportRow {
  key: string; // joined output-dimension values, "" if none
  activeUsers: number;
  revenue: number;
  transactions: number;
}

async function runEventReport(opts: EventReportOptions): Promise<EventReportRow[]> {
  const client = getClient();
  const metrics = [{ name: "activeUsers" }];
  if (opts.includeRevenue) {
    metrics.push({ name: "purchaseRevenue" } as never, { name: "transactions" } as never);
  }

  const request: IRunReportRequest = {
    property: `properties/${ga4Config.propertyId}`,
    dateRanges: [{ startDate: opts.range.start, endDate: opts.range.end }],
    dimensions: opts.outputDimensions.map((name) => ({ name })),
    metrics,
    dimensionFilter: dimensionFilterFor(opts.filters, opts.eventName),
    limit: 100000,
  };

  const [response] = await client.runReport(request);
  const rows = response.rows ?? [];

  return rows.map((row) => {
    const dimValues = (row.dimensionValues ?? []).map((d) => d.value ?? "(not set)");
    const metricValues = row.metricValues ?? [];
    return {
      key: dimValues.join(" / "),
      activeUsers: Number(metricValues[0]?.value ?? 0),
      revenue: opts.includeRevenue ? Number(metricValues[1]?.value ?? 0) : 0,
      transactions: opts.includeRevenue ? Number(metricValues[2]?.value ?? 0) : 0,
    };
  });
}

const FUNNEL_EVENTS: { stage: keyof FunnelCounts; eventName: string; revenue?: boolean }[] = [
  { stage: "sessionStartUsers", eventName: ga4Config.events.sessionStart },
  { stage: "viewItemUsers", eventName: ga4Config.events.viewItem },
  { stage: "addToCartUsers", eventName: ga4Config.events.addToCart },
  { stage: "beginCheckoutUsers", eventName: ga4Config.events.beginCheckout },
  { stage: "checkoutStep2Users", eventName: ga4Config.events.checkoutStep2 },
  { stage: "checkoutStep3Users", eventName: ga4Config.events.checkoutStep3 },
  { stage: "checkoutStep4Users", eventName: ga4Config.events.checkoutStep4 },
  { stage: "checkoutStep5Users", eventName: ga4Config.events.checkoutStep5 },
  { stage: "purchaseUsers", eventName: ga4Config.events.purchase, revenue: true },
];

async function fetchFunnelCountsByKey(
  range: { start: string; end: string },
  filters: DimensionFilters,
  outputDimensions: string[],
): Promise<Map<string, FunnelCounts>> {
  const byKey = new Map<string, FunnelCounts>();

  await Promise.all(
    FUNNEL_EVENTS.map(async ({ stage, eventName, revenue }) => {
      const rows = await runEventReport({
        eventName,
        range,
        filters,
        outputDimensions,
        includeRevenue: revenue,
      });
      for (const row of rows) {
        const counts = byKey.get(row.key) ?? emptyCounts();
        (counts[stage] as number) = row.activeUsers;
        if (revenue) {
          counts.revenue = row.revenue;
          counts.transactions = row.transactions;
        }
        byKey.set(row.key, counts);
      }
    }),
  );

  return byKey;
}

function sumMapValues(map: Map<string, FunnelCounts>): FunnelCounts {
  let total = emptyCounts();
  for (const counts of map.values()) {
    total = {
      sessionStartUsers: total.sessionStartUsers + counts.sessionStartUsers,
      viewItemUsers: total.viewItemUsers + counts.viewItemUsers,
      addToCartUsers: total.addToCartUsers + counts.addToCartUsers,
      beginCheckoutUsers: total.beginCheckoutUsers + counts.beginCheckoutUsers,
      checkoutStep2Users: total.checkoutStep2Users + counts.checkoutStep2Users,
      checkoutStep3Users: total.checkoutStep3Users + counts.checkoutStep3Users,
      checkoutStep4Users: total.checkoutStep4Users + counts.checkoutStep4Users,
      checkoutStep5Users: total.checkoutStep5Users + counts.checkoutStep5Users,
      purchaseUsers: total.purchaseUsers + counts.purchaseUsers,
      revenue: total.revenue + counts.revenue,
      transactions: total.transactions + counts.transactions,
    };
  }
  return total;
}

async function itemDimensionCoverage(
  range: { start: string; end: string },
  filters: DimensionFilters,
  eventName: string,
  ga4Dimension: string,
): Promise<number> {
  const rows = await runEventReport({ eventName, range, filters, outputDimensions: [ga4Dimension] });
  const total = rows.reduce((sum, r) => sum + r.activeUsers, 0);
  if (total === 0) return 1;
  const missing = rows
    .filter((r) => r.key === "(not set)" || r.key === "" || r.key.toLowerCase() === "(none)")
    .reduce((sum, r) => sum + r.activeUsers, 0);
  return 1 - missing / total;
}

export class Ga4DataProvider implements DataProvider {
  readonly mode = "ga4" as const;

  async getFunnelCounts(query: DashboardQuery): Promise<FunnelCounts> {
    const map = await fetchFunnelCountsByKey(query.range, query.filters, []);
    return map.get("") ?? sumMapValues(map);
  }

  async getDailyTrend(query: DashboardQuery): Promise<DailyTrendPoint[]> {
    const map = await fetchFunnelCountsByKey(query.range, query.filters, ["date"]);
    const dates = enumerateDates(query.range);
    return dates.map((iso) => ({
      date: iso,
      counts: map.get(iso.replace(/-/g, "")) ?? emptyCounts(),
    }));
  }

  async getBreakdown(
    query: DashboardQuery,
    dimension: BreakdownDimension,
    comparison: DashboardQuery | null,
  ): Promise<BreakdownRow[]> {
    const outputDimensions = ga4OutputDimensionName(dimension);
    if (outputDimensions.length === 0) {
      // e.g. "brand" requested but no GA4_BRAND_DIMENSION configured.
      return [];
    }

    const currentMap = await fetchFunnelCountsByKey(query.range, query.filters, outputDimensions);
    const comparisonMap = comparison
      ? await fetchFunnelCountsByKey(comparison.range, comparison.filters, outputDimensions)
      : new Map<string, FunnelCounts>();

    const keys = new Set([...currentMap.keys(), ...comparisonMap.keys()]);
    const rows: BreakdownRow[] = [];
    for (const key of keys) {
      const current = currentMap.get(key) ?? emptyCounts();
      const comparisonCounts = comparisonMap.get(key) ?? emptyCounts();
      rows.push({
        dimensionValue: key || "(not set)",
        current,
        comparison: comparisonCounts,
        shoppingEcr: compareEcr(computeShoppingEcr, current, comparison ? comparisonCounts : null),
        checkoutEcr: compareEcr(computeCheckoutEcr, current, comparison ? comparisonCounts : null),
      });
    }
    return rows;
  }

  async getDataQuality(query: DashboardQuery): Promise<DataQualityCheckResult[]> {
    const counts = await this.getFunnelCounts(query);

    const [itemIdCoverage, itemCategoryCoverage, itemListNameCoverage] = await Promise.all([
      itemDimensionCoverage(query.range, query.filters, ga4Config.events.purchase, "itemId"),
      itemDimensionCoverage(query.range, query.filters, ga4Config.events.purchase, "itemCategory"),
      itemDimensionCoverage(query.range, query.filters, ga4Config.events.viewItem, "itemListName"),
    ]);

    const checkoutEventCoverage =
      counts.beginCheckoutUsers > 0
        ? Math.min(
            1,
            (counts.checkoutStep2Users > 0 ? 0.25 : 0) +
              (counts.checkoutStep3Users > 0 ? 0.25 : 0) +
              (counts.checkoutStep4Users > 0 ? 0.25 : 0) +
              (counts.checkoutStep5Users > 0 ? 0.25 : 0),
          )
        : 1;

    const signals: QualitySignals = {
      eventCounts: {
        sessionStart: counts.sessionStartUsers,
        viewItem: counts.viewItemUsers,
        addToCart: counts.addToCartUsers,
        beginCheckout: counts.beginCheckoutUsers,
        purchase: counts.purchaseUsers,
        purchaseRevenue: counts.revenue,
      },
      itemIdCoverage,
      itemCategoryCoverage,
      itemListNameCoverage,
      checkoutEventCoverage,
    };

    return runDataQualityChecks(signals);
  }

  async getFilterOptions(): Promise<FilterOptions> {
    const client = getClient();
    const [metadata] = await client.getMetadata({ name: `properties/${ga4Config.propertyId}/metadata` });
    void metadata; // available for a future "known dimensions" validation step

    const dims = ["platform", "deviceCategory", "country", "city", "sessionSource", "sessionMedium"];
    const request: IRunReportRequest = {
      property: `properties/${ga4Config.propertyId}`,
      dateRanges: [{ startDate: "90daysAgo", endDate: "today" }],
      dimensions: dims.map((name) => ({ name })),
      metrics: [{ name: "activeUsers" }],
      limit: 100000,
    };
    const [response] = await client.runReport(request);
    const rows = response.rows ?? [];

    const collect = (idx: number) =>
      Array.from(new Set(rows.map((r) => r.dimensionValues?.[idx]?.value ?? "(not set)"))).sort();

    return {
      brands: ga4Config.brandDimension ? [] : ["Default"],
      platforms: collect(0),
      devices: collect(1),
      countries: collect(2),
      ga4Cities: collect(3),
      trafficSources: collect(4),
      trafficMediums: collect(5),
      dataRange: { start: "2015-08-14", end: new Date().toISOString().slice(0, 10) },
    };
  }
}
