import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data-providers";
import { cached } from "@/lib/cache";
import { getComparisonRange } from "@/lib/date-utils";
import { parseQuery, parseComparisonMode, handleApiError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const query = parseQuery(req.nextUrl.searchParams);
    const comparisonMode = parseComparisonMode(req.nextUrl.searchParams);
    const provider = getDataProvider();
    const filterKey = JSON.stringify(query.filters);

    const points = await cached(`trend:${provider.mode}:${query.range.start}:${query.range.end}:${filterKey}`, () =>
      provider.getDailyTrend(query),
    );

    const comparisonRange = getComparisonRange(query.range, comparisonMode);
    const comparisonPoints = comparisonRange
      ? await cached(
          `trend:${provider.mode}:${comparisonRange.start}:${comparisonRange.end}:${filterKey}`,
          () => provider.getDailyTrend({ range: comparisonRange, filters: query.filters }),
        )
      : null;

    return NextResponse.json({
      mode: provider.mode,
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
