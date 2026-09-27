import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data-providers";
import { cached } from "@/lib/cache";
import { parseQuery, handleApiError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const query = parseQuery(req.nextUrl.searchParams);
    const provider = getDataProvider();
    const filterKey = JSON.stringify(query.filters);

    const checks = await cached(
      `quality:${provider.mode}:${query.range.start}:${query.range.end}:${filterKey}`,
      () => provider.getDataQuality(query),
    );

    return NextResponse.json({ mode: provider.mode, checks });
  } catch (err) {
    return handleApiError(err);
  }
}
