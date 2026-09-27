/**
 * Deterministic synthetic-data generator backing the mock provider.
 *
 * IMPORTANT: every number this module produces is synthetic. It exists so
 * the dashboard is fully interactive without real GA4 credentials. It must
 * never be mistaken for real business data — the mock provider tags every
 * response with mode: "mock" and the UI renders a persistent "Demo Data"
 * badge whenever that mode is active.
 *
 * Generation is a pure function of (date, dimension combo): nothing is
 * cached or mutated, so results are 100% reproducible and cheap to compute
 * only for the slice a request actually needs.
 */
import { addDays, daysBetween, formatIsoDate, parseIsoDate, today } from "../date-utils";
import type { DimensionFilters, FunnelCounts } from "../types";

export interface Combo {
  brand: string;
  brandMult: number;
  brandShare: number;
  platform: string;
  device: string;
  platformDeviceMult: number;
  platformDeviceShare: number;
  country: string;
  ga4City: string;
  countryCityMult: number;
  countryCityShare: number;
  trafficSource: string;
  trafficMedium: string;
  sourceMediumMult: number;
  sourceMediumShare: number;
}

const BRANDS = [
  { value: "Bakingo", share: 0.85, mult: 1.0 },
  { value: "Bakingo International", share: 0.15, mult: 0.9 },
];

const PLATFORM_DEVICE = [
  { platform: "Web", device: "desktop", share: 0.2, mult: 1.05 },
  { platform: "Web", device: "mobile", share: 0.3, mult: 0.95 },
  { platform: "Web", device: "tablet", share: 0.05, mult: 1.0 },
  { platform: "Android App", device: "mobile", share: 0.25, mult: 1.15 },
  { platform: "Android App", device: "tablet", share: 0.03, mult: 1.1 },
  { platform: "iOS App", device: "mobile", share: 0.15, mult: 1.2 },
  { platform: "iOS App", device: "tablet", share: 0.02, mult: 1.15 },
];

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
  for (const b of BRANDS) {
    for (const pd of PLATFORM_DEVICE) {
      for (const cc of COUNTRY_CITY) {
        for (const sm of SOURCE_MEDIUM) {
          combos.push({
            brand: b.value,
            brandMult: b.mult,
            brandShare: b.share,
            platform: pd.platform,
            device: pd.device,
            platformDeviceMult: pd.mult,
            platformDeviceShare: pd.share,
            country: cc.country,
            ga4City: cc.ga4City,
            countryCityMult: cc.mult,
            countryCityShare: cc.share,
            trafficSource: sm.trafficSource,
            trafficMedium: sm.trafficMedium,
            sourceMediumMult: sm.mult,
            sourceMediumShare: sm.share,
          });
        }
      }
    }
  }
  cachedCombos = combos;
  return combos;
}

export function comboMatchesFilters(combo: Combo, filters: DimensionFilters): boolean {
  if (filters.brand?.length && !filters.brand.includes(combo.brand)) return false;
  if (filters.platform?.length && !filters.platform.includes(combo.platform)) return false;
  if (filters.device?.length && !filters.device.includes(combo.device)) return false;
  if (filters.country?.length && !filters.country.includes(combo.country)) return false;
  if (filters.ga4City?.length && !filters.ga4City.includes(combo.ga4City)) return false;
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
  // mulberry32 single-step
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

interface DateBaseline {
  sessionStart: number;
  viewItemRate: number;
  addToCartRate: number;
  checkoutRate: number;
  purchaseRate: number;
  step2Rate: number;
  step3Rate: number;
  step4Rate: number;
  step5Rate: number;
  checkoutPurchaseRate: number;
  avgOrderValue: number;
}

const RECENT_DIP_WINDOW_DAYS = 14;

function recentDipStrength(iso: string): number {
  const offset = offsetFromToday(iso);
  if (offset < 0 || offset >= RECENT_DIP_WINDOW_DAYS) return 0;
  // Ramps from 0 (14 days ago) to 1 (today) so the deterioration reads as a
  // real recent trend rather than a single noisy day.
  return 1 - offset / RECENT_DIP_WINDOW_DAYS;
}

function dateBaseline(iso: string): DateBaseline {
  const angle = dayAngle(iso);
  const weekday = parseIsoDate(iso).getUTCDay();
  const noise = (parts: string) => (seededFloat(iso, parts) - 0.5) * 0.04;
  const daysSinceEpoch = daysBetween("2024-01-01", iso);
  const growthTrend = 1 + daysSinceEpoch * 0.00012; // slow YoY-ish growth
  const dip = recentDipStrength(iso);

  const sessionStart = Math.round(
    10300 * WEEKDAY_FACTOR[weekday] * growthTrend * (1 + 0.05 * Math.sin(angle)) * (1 + noise("vol")),
  );

  return {
    sessionStart,
    viewItemRate: clamp(0.31 + 0.02 * Math.sin(angle + 1) + noise("vi"), 0.2, 0.45),
    addToCartRate: clamp(0.38 + 0.02 * Math.cos(angle) + noise("atc"), 0.25, 0.55),
    checkoutRate: clamp(0.91 + noise("co") * 0.5 - dip * 0.02, 0.8, 0.97),
    purchaseRate: clamp(0.47 + 0.015 * Math.sin(angle - 1) + noise("pu") - dip * 0.05, 0.3, 0.6),
    step2Rate: clamp(0.8 + noise("s2") - dip * 0.03, 0.65, 0.92),
    step3Rate: clamp(0.86 + noise("s3") - dip * 0.02, 0.7, 0.95),
    step4Rate: clamp(0.98 + noise("s4") * 0.3, 0.9, 1.0),
    step5Rate: clamp(0.9 + noise("s5") - dip * 0.02, 0.75, 0.97),
    checkoutPurchaseRate: clamp(0.77 + noise("cp") - dip * 0.06, 0.55, 0.9),
    avgOrderValue: Math.round(1450 + 80 * Math.sin(angle) + seededFloat(iso, "aov") * 60),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Extra deterioration applied on top of the base recent dip, targeted at specific dimension
 *  values so the "where did ECR drop?" section has a real story to surface. Demo-only. */
function comboDipMultiplier(combo: Combo, iso: string): number {
  const dip = recentDipStrength(iso);
  if (dip === 0) return 1;
  let mult = 1;
  if (combo.platform === "Android App") mult *= 1 - 0.06 * dip;
  if (combo.ga4City === "Gurgaon") mult *= 1 - 0.05 * dip;
  return mult;
}

export function comboCounts(combo: Combo, iso: string): FunnelCounts {
  const base = dateBaseline(iso);
  const shareMult = combo.brandShare * combo.platformDeviceShare * combo.countryCityShare * combo.sourceMediumShare;
  const rateMult = combo.brandMult * combo.platformDeviceMult * combo.countryCityMult * combo.sourceMediumMult;
  const dipMult = comboDipMultiplier(combo, iso);

  const sessionStartUsers = Math.max(0, Math.round(base.sessionStart * shareMult));
  const viewItemUsers = Math.round(sessionStartUsers * clamp(base.viewItemRate * rateMult, 0, 1));
  const addToCartUsers = Math.round(viewItemUsers * clamp(base.addToCartRate * rateMult, 0, 1));
  const beginCheckoutUsers = Math.round(addToCartUsers * clamp(base.checkoutRate * rateMult * dipMult, 0, 1));

  const checkoutStep2Users = Math.round(beginCheckoutUsers * clamp(base.step2Rate * dipMult, 0, 1));
  const checkoutStep3Users = Math.round(checkoutStep2Users * clamp(base.step3Rate * dipMult, 0, 1));
  const checkoutStep4Users = Math.round(checkoutStep3Users * clamp(base.step4Rate, 0, 1));
  const checkoutStep5Users = Math.round(checkoutStep4Users * clamp(base.step5Rate * dipMult, 0, 1));
  const purchaseUsers = Math.round(checkoutStep5Users * clamp(base.checkoutPurchaseRate * dipMult, 0, 1));

  const transactions = Math.round(purchaseUsers * 1.02);
  const revenue = Math.round(purchaseUsers * base.avgOrderValue);

  return {
    sessionStartUsers,
    viewItemUsers,
    addToCartUsers,
    beginCheckoutUsers,
    checkoutStep2Users,
    checkoutStep3Users,
    checkoutStep4Users,
    checkoutStep5Users,
    purchaseUsers,
    revenue,
    transactions,
  };
}

export function demoDataRange(): { start: string; end: string } {
  const end = today();
  return { start: addDays(end, -DEMO_DATA_START_OFFSET_DAYS), end };
}

export function isWithinDemoRange(iso: string): boolean {
  const { start, end } = demoDataRange();
  return iso >= start && iso <= end;
}

export { formatIsoDate };
