import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data-providers";
import { getProperty } from "@/lib/properties";
import { cached } from "@/lib/cache";
import { getComparisonRange } from "@/lib/date-utils";
import { parseQuery, parseComparisonMode, handleApiError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const query = parseQuery(req.nextUrl.searchParams);
    const property = getProperty(query.property);
    const comparisonMode = parseComparisonMode(req.nextUrl.searchParams);
    const provider = getDataProvider(property);
    const filterKey = JSON.stringify(query.filters);
    const cacheKeyBase = `trend:${property.key}:${provider.mode}`;

    const points = await cached(`${cacheKeyBase}:${query.range.start}:${query.range.end}:${filterKey}`, () =>
      provider.getDailyTrend(property, query),
    );

    const comparisonRange = getComparisonRange(query.range, comparisonMode);
    const comparisonPoints = comparisonRange
      ? await cached(`${cacheKeyBase}:${comparisonRange.start}:${comparisonRange.end}:${filterKey}`, () =>
          provider.getDailyTrend(property, { property: property.key, range: comparisonRange, filters: query.filters }),
        )
      : null;

    return NextResponse.json({
      mode: provider.mode,
      property: property.key,
      range: query.range,
      comparisonMode,
      comparisonRange,
      points,
      comparisonPoints,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
