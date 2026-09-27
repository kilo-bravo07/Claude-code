import { MockDataProvider } from "./mock-provider";
import { isGa4Configured } from "./ga4-config";
import type { DataProvider } from "./types";

let cached: DataProvider | null = null;

/**
 * Provider selection: explicit DATA_PROVIDER=mock always forces demo data
 * (useful for local dev / screenshots even once GA4 is wired up).
 * DATA_PROVIDER=ga4 forces the real provider (and throws immediately if
 * credentials are missing, so misconfiguration fails loudly rather than
 * silently falling back to demo numbers).
 * Otherwise: use GA4 if fully configured, else fall back to mock.
 */
export function getDataProvider(): DataProvider {
  if (cached) return cached;

  const mode = process.env.DATA_PROVIDER?.trim().toLowerCase();

  if (mode === "mock") {
    cached = new MockDataProvider();
    return cached;
  }

  if (mode === "ga4" || isGa4Configured()) {
    // Lazy import so the @google-analytics/data SDK is never touched in pure demo mode.
    const { Ga4DataProvider } = require("./ga4-provider") as typeof import("./ga4-provider");
    cached = new Ga4DataProvider();
    return cached;
  }

  cached = new MockDataProvider();
  return cached;
}

export type { DataProvider } from "./types";
