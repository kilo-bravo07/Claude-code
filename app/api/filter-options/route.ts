import { NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data-providers";
import { cached } from "@/lib/cache";
import { handleApiError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const provider = getDataProvider();
    const options = await cached(`filter-options:${provider.mode}`, () => provider.getFilterOptions(), 30 * 60 * 1000);
    return NextResponse.json({ mode: provider.mode, ...options });
  } catch (err) {
    return handleApiError(err);
  }
}
