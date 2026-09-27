import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data-providers";
import { cached } from "@/lib/cache";
import { parseProperty, handleApiError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const property = parseProperty(req.nextUrl.searchParams);
    const provider = getDataProvider(property);
    const options = await cached(
      `filter-options:${property.key}:${provider.mode}`,
      () => provider.getFilterOptions(property),
      30 * 60 * 1000,
    );
    return NextResponse.json({ mode: provider.mode, property: property.key, ...options });
  } catch (err) {
    return handleApiError(err);
  }
}
