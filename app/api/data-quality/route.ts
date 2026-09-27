import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data-providers";
import { getProperty } from "@/lib/properties";
import { cached } from "@/lib/cache";
import { parseQuery, handleApiError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const query = parseQuery(req.nextUrl.searchParams);
    const property = getProperty(query.property);
    const provider = getDataProvider(property);
    const filterKey = JSON.stringify(query.filters);

    const checks = await cached(
      `quality:${property.key}:${provider.mode}:${query.range.start}:${query.range.end}:${filterKey}`,
      () => provider.getDataQuality(property, query),
    );

    return NextResponse.json({ mode: provider.mode, property: property.key, checks });
  } catch (err) {
    return handleApiError(err);
  }
}
