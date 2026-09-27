/**
 * One property = one GA4 data source (a brand+platform combination). Every
 * property-specific detail — event names, funnel shape, labels, which
 * metrics exist, which filters are meaningful — lives in a config object
 * here. Nothing outside lib/properties/** and the data-provider layer is
 * allowed to hardcode an event name or assume a funnel shape: components
 * render whatever a PropertyConfig describes.
 */

export type PropertyKey = "floweraura-web" | "floweraura-app" | "bakingo-web" | "bakingo-app";

export type FilterKey = "ga4City" | "country" | "device" | "trafficSource" | "trafficMedium";

/** One stage in a funnel. Its rate = count[key] / count[previous stage's key] (or the funnel's root for the first stage). */
export interface FunnelStageConfig {
  /** Stable key used to look up this stage's raw count. Also doubles as the GA4 event name unless ga4EventName is set. */
  key: string;
  label: string;
  /** GA4 event name backing this stage, if it corresponds to a literal event (all funnel stages do). */
  ga4EventName: string;
}

export interface MetricDefinition {
  key: string;
  label: string;
  numeratorKey: string;
  denominatorKey: string;
  /** One-line explanation shown on the Definitions page. */
  description: string;
}

/**
 * A GA4 dimension condition applied to every query for one funnel, on top of
 * the eventName restriction and whatever dimension filters the user picked
 * in the filter bar (device/country/city/source/medium). This is how a
 * property's OWN GA4 reporting methodology — e.g. excluding blog landing
 * pages or a specific ad platform's traffic — gets reproduced exactly,
 * rather than approximated. Shopping and checkout funnels can (and for
 * FlowerAura Web, do) declare different conditions, which is why the two
 * funnels are always fetched as separate GA4 requests, never combined.
 */
export interface Ga4FilterCondition {
  /** GA4 API dimension name, e.g. "landingPage", "sessionCampaignName", "sessionSourceMedium". */
  dimension: string;
  match: "full_regexp" | "partial_regexp" | "contains";
  /** Regex alternation (e.g. "blog|/p/|quote|shayari") for the two regexp match types, or a plain substring for "contains". */
  value: string;
  /** true = exclude rows matching this condition (a "NOT" clause). Defaults to false (include only matches). */
  negate?: boolean;
}

export interface FunnelDefinition {
  /** The funnel's entry point (denominator for the first stage's rate, and default ECR denominator). Not shown as its own KPI card — it's shown in the raw-counts / funnel-diagram "start" row. */
  root: FunnelStageConfig;
  /** Displayed, in order. Each stage's rate divides by the previous entry (or root for the first one). */
  stages: FunnelStageConfig[];
  /** The funnel's headline ECR metric (always present). */
  ecr: MetricDefinition;
  /** Extra GA4 filter conditions specific to this funnel's own reporting methodology (see Ga4FilterCondition). Omit/empty for "use the raw events as-is". */
  baseFilters?: Ga4FilterCondition[];
}

/** A metric that isn't part of the sequential stage chain (e.g. FlowerAura App's "New ECR" ÷ ActiveUsers). */
export interface AdditionalMetric extends MetricDefinition {}

/** A raw count tracked alongside the funnels but not itself a funnel stage (e.g. GA4 "activeUsers" totals). */
export interface ExtraRawMetric {
  key: string;
  label: string;
  /** null when this is a GA4 metric (e.g. activeUsers) rather than an event count. */
  ga4EventName: string | null;
}

export interface MockProfile {
  /** Approximate baseline daily volume for the funnel root, used only to generate realistic demo data. */
  baseRootVolume: number;
  /** Baseline conversion rate (0-1) for each shopping stage, keyed by stage key; first stage's rate is vs. root. */
  shoppingStageRates: Record<string, number>;
  /** Baseline rate (0-1) of the checkout funnel's root relative to the shopping funnel's root — demo data only. */
  checkoutRootRate: number;
  checkoutStageRates: Record<string, number>;
  /** Baseline rate (0-1) of each extra metric relative to the shopping root. */
  extraMetricRates?: Record<string, number>;
  /** A GA4 city to lean the synthetic "recent dip" story into, if this property has a city filter. */
  storyCity?: string;
}

export interface PropertyConfig {
  key: PropertyKey;
  displayName: string;
  brand: string;
  platform: string;
  /** Name of the env var holding this property's GA4 property ID (e.g. "FLOWERAURA_WEB_GA4_PROPERTY_ID"). */
  ga4PropertyIdEnvVar: string;
  shopping: FunnelDefinition;
  checkout: FunnelDefinition;
  additionalMetrics: AdditionalMetric[];
  extraMetrics: ExtraRawMetric[];
  availableFilters: FilterKey[];
  mockProfile: MockProfile;
}

export const FILTER_LABELS: Record<FilterKey, string> = {
  ga4City: "GA4 City",
  country: "Country",
  device: "Device",
  trafficSource: "Traffic Source",
  trafficMedium: "Traffic Medium",
};
