import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data-providers";
import { getProperty } from "@/lib/properties";
import { cached } from "@/lib/cache";
import { getComparisonRange } from "@/lib/date-utils";
import { parseQuery, parseComparisonMode, handleApiError, ApiError } from "@/lib/api-utils";
import type { BreakdownDimension } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_DIMENSIONS: BreakdownDimension[] = ["ga4City", "country", "device", "trafficSourceMedium"];

export async function GET(req: NextRequest) {
  try {
    const query = parseQuery(req.nextUrl.searchParams);
    const property = getProperty(query.property);
    const comparisonMode = parseComparisonMode(req.nextUrl.searchParams);
    const dimension = req.nextUrl.searchParams.get("dimension") as BreakdownDimension | null;
    if (!dimension || !VALID_DIMENSIONS.includes(dimension)) {
      throw new ApiError(400, `Invalid or missing 'dimension'. Must be one of: ${VALID_DIMENSIONS.join(", ")}`);
    }

    const provider = getDataProvider(property);
    const filterKey = JSON.stringify(query.filters);
    const comparisonRange = getComparisonRange(query.range, comparisonMode);
    const comparisonQuery = comparisonRange
      ? { property: property.key, range: comparisonRange, filters: query.filters }
      : null;

    const rows = await cached(
      `breakdown:${property.key}:${provider.mode}:${dimension}:${query.range.start}:${query.range.end}:${comparisonMode}:${filterKey}`,
      () => provider.getBreakdown(property, query, dimension, comparisonQuery),
    );

    return NextResponse.json({ mode: provider.mode, property: property.key, dimension, comparisonMode, rows });
  } catch (err) {
    return handleApiError(err);
  }
}
