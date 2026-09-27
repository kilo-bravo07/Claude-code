import { NextResponse } from "next/server";
import { getProperty, isPropertyKey } from "./properties";
import type { PropertyConfig } from "./properties/types";
import type { ComparisonMode, DashboardQuery, DimensionFilters } from "./types";

function listParam(params: URLSearchParams, key: string): string[] | undefined {
  const raw = params.get(key);
  if (!raw) return undefined;
  const values = raw.split(",").map((v) => v.trim()).filter(Boolean);
  return values.length ? values : undefined;
}

export function parseFilters(params: URLSearchParams): DimensionFilters {
  return {
    device: listParam(params, "device"),
    country: listParam(params, "country"),
    ga4City: listParam(params, "ga4City"),
    trafficSource: listParam(params, "trafficSource"),
    trafficMedium: listParam(params, "trafficMedium"),
  };
}

export function parseProperty(params: URLSearchParams): PropertyConfig {
  const key = params.get("property");
  if (!key || !isPropertyKey(key)) {
    throw new ApiError(400, "Missing or invalid 'property' query parameter. Must be one of the configured property keys.");
  }
  return getProperty(key);
}

export function parseQuery(params: URLSearchParams): DashboardQuery {
  const start = params.get("start");
  const end = params.get("end");
  if (!start || !end) {
    throw new ApiError(400, "Missing required 'start' and 'end' date query parameters (ISO yyyy-mm-dd).");
  }
  const property = parseProperty(params);
  return { property: property.key, range: { start, end }, filters: parseFilters(params) };
}

export function parseComparisonMode(params: URLSearchParams): ComparisonMode {
  const raw = params.get("comparison");
  if (raw === "d7" || raw === "d365" || raw === "none") return raw;
  return "d7";
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Unknown server error";
  // eslint-disable-next-line no-console
  console.error("API error:", err);
  return NextResponse.json({ error: message }, { status: 502 });
}
