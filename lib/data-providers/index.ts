import { MockDataProvider } from "./mock-provider";
import { isPropertyConfigured } from "./ga4-config";
import type { PropertyConfig } from "../properties/types";
import type { DataProvider } from "./types";

const mock = new MockDataProvider();
let ga4Singleton: DataProvider | null = null;

function getGa4Provider(): DataProvider {
  if (!ga4Singleton) {
    // Lazy import so the @google-analytics/data SDK is never touched in pure demo mode.
    const { Ga4DataProvider } = require("./ga4-provider") as typeof import("./ga4-provider");
    ga4Singleton = new Ga4DataProvider();
  }
  return ga4Singleton;
}

/**
 * Provider selection is PER PROPERTY: one property can be live on GA4 while
 * another still falls back to demo data, since each has its own
 * GA4_PROPERTY_ID and may be connected independently (spec section 24/29).
 *
 * DATA_PROVIDER=mock forces demo data everywhere (handy for screenshots).
 * DATA_PROVIDER=ga4 forces the real provider for every property, and throws
 * immediately if that property's credentials are missing, so misconfiguration
 * fails loudly rather than silently falling back to demo numbers.
 * Otherwise: use GA4 for a given property once it's configured, else mock.
 */
export function getDataProvider(property: PropertyConfig): DataProvider {
  const mode = process.env.DATA_PROVIDER?.trim().toLowerCase();

  if (mode === "mock") return mock;
  if (mode === "ga4") return getGa4Provider();
  return isPropertyConfigured(property) ? getGa4Provider() : mock;
}

export function isPropertyLive(property: PropertyConfig): boolean {
  const mode = process.env.DATA_PROVIDER?.trim().toLowerCase();
  if (mode === "mock") return false;
  if (mode === "ga4") return true;
  return isPropertyConfigured(property);
}

export type { DataProvider } from "./types";
