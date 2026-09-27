import { CACHE_TTL_MS } from "./config";

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

/**
 * Process-wide TTL cache for provider responses. Keyed on the full query
 * (range + filters + whatever else the caller mixes in), so re-fetching the
 * same slice within CACHE_TTL_MS (e.g. re-rendering multiple dashboard
 * sections from the same filter state, or the user flipping back and forth
 * between two date ranges) never re-hits GA4 — this is what keeps the app
 * from firing "dozens of identical GA4 API calls every time a filter
 * changes" (spec section 18).
 */
export async function cached<T>(key: string, fn: () => Promise<T>, ttlMs: number = CACHE_TTL_MS): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }
  const value = await fn();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function clearCache(): void {
  store.clear();
}
