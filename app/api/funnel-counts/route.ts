import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data-providers";
import { cached } from "@/lib/cache";
import { getComparisonRange } from "@/lib/date-utils";
import { parseQuery, handleApiError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const query = parseQuery(req.nextUrl.searchParams);
    const provider = getDataProvider();
    const filterKey = JSON.stringify(query.filters);

    const d7Range = getComparisonRange(query.range, "d7");
    const d365Range = getComparisonRange(query.range, "d365");

    const [current, d7, d365] = await Promise.all([
      cached(`funnel:${provider.mode}:${query.range.start}:${query.range.end}:${filterKey}`, () =>
        provider.getFunnelCounts(query),
      ),
      d7Range
        ? cached(`funnel:${provider.mode}:${d7Range.start}:${d7Range.end}:${filterKey}`, () =>
            provider.getFunnelCounts({ range: d7Range, filters: query.filters }),
          )
        : null,
      d365Range
        ? cached(`funnel:${provider.mode}:${d365Range.start}:${d365Range.end}:${filterKey}`, () =>
            provider.getFunnelCounts({ range: d365Range, filters: query.filters }),
          )
        : null,
    ]);

    return NextResponse.json({
      mode: provider.mode,
      range: query.range,
      current,
      d7: d7Range ? { range: d7Range, counts: d7 } : null,
      d365: d365Range ? { range: d365Range, counts: d365 } : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
