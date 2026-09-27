/**
 * Deterministic synthetic-data generator backing the mock provider.
 *
 * IMPORTANT: every number this module produces is synthetic. It exists so
 * the dashboard is fully interactive without real GA4 credentials. It must
 * never be mistaken for real business data — the mock provider tags every
 * response with mode: "mock" and the UI renders a persistent "Demo Data"
 * badge whenever that mode is active.
 *
 * Generic across all four properties: it walks whatever funnel shape and
 * baseline rates a property's `mockProfile` declares (lib/properties/*.ts)
 * rather than assuming a fixed stage list. Generation is a pure function of
 * (property, date, dimension combo): nothing is cached or mutated, so
 * results are 100% reproducible and cheap to compute only for the slice a
 * request actually needs.
 */
import { addDays, daysBetween, parseIsoDate, today } from "../date-utils";
import type { DimensionFilters, RawCounts } from "../types";
import type { PropertyConfig } from "../properties/types";

export interface Combo {
  country: string;
  ga4City: string;
  countryCityMult: number;
  countryCityShare: number;
  device: string;
  deviceMult: number;
  deviceShare: number;
  trafficSource: string;
  trafficMedium: string;
  sourceMediumMult: number;
  sourceMediumShare: number;
}

const COUNTRY_CITY = [
  { country: "India", ga4City: "Delhi", share: 0.18, mult: 1.05 },
  { country: "India", ga4City: "Gurgaon", share: 0.14, mult: 1.0 },
  { country: "India", ga4City: "Noida", share: 0.1, mult: 0.95 },
  { country: "India", ga4City: "Mumbai", share: 0.12, mult: 1.02 },
  { country: "India", ga4City: "Bengaluru", share: 0.1, mult: 1.08 },
  { country: "India", ga4City: "Other", share: 0.16, mult: 0.9 },
  { country: "United States", ga4City: "Other", share: 0.08, mult: 0.85 },
  { country: "United Arab Emirates", ga4City: "Other", share: 0.06, mult: 0.9 },
  { country: "United Kingdom", ga4City: "Other", share: 0.06, mult: 0.88 },
];

const DEVICE = [
  { device: "mobile", share: 0.6, mult: 0.97 },
  { device: "desktop", share: 0.3, mult: 1.06 },
  { device: "tablet", share: 0.1, mult: 1.0 },
];

const SOURCE_MEDIUM = [
  { trafficSource: "google", trafficMedium: "organic", share: 0.35, mult: 1.05 },
  { trafficSource: "google", trafficMedium: "cpc", share: 0.25, mult: 0.95 },
  { trafficSource: "direct", trafficMedium: "(none)", share: 0.25, mult: 1.1 },
  { trafficSource: "facebook", trafficMedium: "cpc", share: 0.15, mult: 0.85 },
];

export const DEMO_DATA_START_OFFSET_DAYS = 400;

let cachedCombos: Combo[] | null = null;

export function buildCombos(): Combo[] {
  if (cachedCombos) return cachedCombos;
  const combos: Combo[] = [];
  for (const cc of COUNTRY_CITY) {
    for (const d of DEVICE) {
      for (const sm of SOURCE_MEDIUM) {
        combos.push({
          country: cc.country,
          ga4City: cc.ga4City,
          countryCityMult: cc.mult,
          countryCityShare: cc.share,
          device: d.device,
          deviceMult: d.mult,
          deviceShare: d.share,
          trafficSource: sm.trafficSource,
          trafficMedium: sm.trafficMedium,
          sourceMediumMult: sm.mult,
          sourceMediumShare: sm.share,
        });
      }
    }
  }
  cachedCombos = combos;
  return combos;
}

export function comboMatchesFilters(combo: Combo, filters: DimensionFilters): boolean {
  if (filters.country?.length && !filters.country.includes(combo.country)) return false;
  if (filters.ga4City?.length && !filters.ga4City.includes(combo.ga4City)) return false;
  if (filters.device?.length && !filters.device.includes(combo.device)) return false;
  if (filters.trafficSource?.length && !filters.trafficSource.includes(combo.trafficSource)) return false;
  if (filters.trafficMedium?.length && !filters.trafficMedium.includes(combo.trafficMedium)) return false;
  return true;
}

// --- deterministic pseudo-randomness -------------------------------------

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic float in [0, 1) derived from arbitrary string parts. */
function seededFloat(...parts: (string | number)[]): number {
  const seed = hashString(parts.join("|"));
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const WEEKDAY_FACTOR = [0.92, 1.03, 1.05, 1.04, 1.06, 1.08, 0.95]; // Sun..Sat

function dayAngle(iso: string): number {
  const dayOfYear = daysBetween(`${iso.slice(0, 4)}-01-01`, iso);
  return (dayOfYear / 365) * 2 * Math.PI;
}

/** How many days before "now" this date falls (0 = today, positive = in the past). Negative = future. */
function offsetFromToday(iso: string): number {
  return daysBetween(iso, today());
}

const RECENT_DIP_WINDOW_DAYS = 14;

function recentDipStrength(iso: string): number {
  const offset = offsetFromToday(iso);
  if (offset < 0 || offset >= RECENT_DIP_WINDOW_DAYS) return 0;
  // Ramps from 0 (14 days ago) to 1 (today) so the deterioration reads as a
  // real recent trend rather than a single noisy day.
  return 1 - offset / RECENT_DIP_WINDOW_DAYS;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function volumeFactor(iso: string): number {
  const angle = dayAngle(iso);
  const weekday = parseIsoDate(iso).getUTCDay();
  const daysSinceEpoch = daysBetween("2024-01-01", iso);
  const growthTrend = 1 + daysSinceEpoch * 0.00012;
  const noise = (seededFloat(iso, "vol") - 0.5) * 0.06;
  return WEEKDAY_FACTOR[weekday] * growthTrend * (1 + 0.05 * Math.sin(angle)) * (1 + noise);
}

/** Extra deterioration applied on top of the base recent dip, targeted at the property's "story city" if it has one, so "Where did ECR drop?" has a real story to surface. Demo-only. */
function comboDipMultiplier(property: PropertyConfig, combo: Combo, iso: string): number {
  const dip = recentDipStrength(iso);
  if (dip === 0) return 1;
  let mult = 1 - 0.03 * dip; // small uniform dip everywhere
  if (property.mockProfile.storyCity && combo.ga4City === property.mockProfile.storyCity) {
    mult *= 1 - 0.05 * dip;
  }
  return mult;
}

/** Computes one dimension-combo's raw counts for one property on one date — both shopping and checkout funnels, plus any extra metrics. */
export function comboCounts(property: PropertyConfig, combo: Combo, iso: string): RawCounts {
  const profile = property.mockProfile;
  const shareMult = combo.countryCityShare * combo.deviceShare * combo.sourceMediumShare;
  const rateMult = combo.countryCityMult * combo.deviceMult * combo.sourceMediumMult;
  const dipMult = comboDipMultiplier(property, combo, iso);

  const counts: RawCounts = {};
  const rootCount = Math.max(0, Math.round(profile.baseRootVolume * volumeFactor(iso) * shareMult));
  counts[property.shopping.root.key] = rootCount;

  let prevCount = rootCount;
  property.shopping.stages.forEach((stage, i) => {
    const baseRateValue = profile.shoppingStageRates[stage.key] ?? 0.5;
    const noise = (seededFloat(iso, "shop", stage.key) - 0.5) * 0.06;
    const isLateStage = i >= property.shopping.stages.length - 2;
    const effectiveRate = clamp(
      baseRateValue * rateMult * (1 + noise) * (isLateStage ? dipMult : 1),
      0,
      Math.max(1, baseRateValue * 1.3),
    );
    const count = Math.round(prevCount * effectiveRate);
    counts[stage.key] = count;
    prevCount = count;
  });

  property.extraMetrics.forEach((metric) => {
    const baseRateValue = profile.extraMetricRates?.[metric.key] ?? 1;
    const noise = (seededFloat(iso, "extra", metric.key) - 0.5) * 0.04;
    counts[metric.key] = Math.max(0, Math.round(rootCount * baseRateValue * (1 + noise)));
  });

  // The checkout funnel's root is always derived independently from its own
  // baseline rate, never reused from a shopping-stage count: its raw-counts
  // key is guaranteed distinct by construction (see each property's config),
  // since a property's checkout funnel can apply its own GA4 filter
  // conditions and is not guaranteed to produce the same count as a
  // same-named shopping stage even when both trace back to the same event.
  const checkoutNoise = (seededFloat(iso, "checkoutRoot") - 0.5) * 0.06;
  const checkoutRootCount = Math.max(0, Math.round(rootCount * profile.checkoutRootRate * (1 + checkoutNoise)));
  counts[property.checkout.root.key] = checkoutRootCount;

  let prevCheckoutCount = checkoutRootCount;
  property.checkout.stages.forEach((stage) => {
    const baseRateValue = profile.checkoutStageRates[stage.key] ?? 0.85;
    const noise = (seededFloat(iso, "checkout", stage.key) - 0.5) * 0.05;
    const effectiveRate = clamp(baseRateValue * (1 + noise) * dipMult, 0, Math.max(1.2, baseRateValue * 1.3));
    const count = Math.round(prevCheckoutCount * effectiveRate);
    counts[stage.key] = count;
    prevCheckoutCount = count;
  });

  return counts;
}

export function demoDataRange(): { start: string; end: string } {
  const end = today();
  return { start: addDays(end, -DEMO_DATA_START_OFFSET_DAYS), end };
}
