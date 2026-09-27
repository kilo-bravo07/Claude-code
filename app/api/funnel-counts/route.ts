import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data-providers";
import { getProperty } from "@/lib/properties";
import { cached } from "@/lib/cache";
import { getComparisonRange } from "@/lib/date-utils";
import { parseQuery, handleApiError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const query = parseQuery(req.nextUrl.searchParams);
    const property = getProperty(query.property);
    const provider = getDataProvider(property);
    const filterKey = JSON.stringify(query.filters);
    const cacheKeyBase = `funnel:${property.key}:${provider.mode}`;

    const d7Range = getComparisonRange(query.range, "d7");
    const d365Range = getComparisonRange(query.range, "d365");

    const [current, d7, d365] = await Promise.all([
      cached(`${cacheKeyBase}:${query.range.start}:${query.range.end}:${filterKey}`, () =>
        provider.getFunnelCounts(property, query),
      ),
      d7Range
        ? cached(`${cacheKeyBase}:${d7Range.start}:${d7Range.end}:${filterKey}`, () =>
            provider.getFunnelCounts(property, { property: property.key, range: d7Range, filters: query.filters }),
          )
        : null,
      d365Range
        ? cached(`${cacheKeyBase}:${d365Range.start}:${d365Range.end}:${filterKey}`, () =>
            provider.getFunnelCounts(property, { property: property.key, range: d365Range, filters: query.filters }),
          )
        : null,
    ]);

    return NextResponse.json({
      mode: provider.mode,
      property: property.key,
      range: query.range,
      current,
      d7: d7Range ? { range: d7Range, counts: d7 } : null,
      d365: d365Range ? { range: d365Range, counts: d365 } : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
