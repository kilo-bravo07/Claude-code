import { NextResponse } from "next/server";
import { isPropertyKey, getProperty } from "@/lib/properties";
import { isPropertyConfigured } from "@/lib/data-providers/ga4-config";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;

  if (!isPropertyKey(key)) {
    return NextResponse.json({ ok: false, error: `Unknown property key '${key}'.` }, { status: 400 });
  }
  const property = getProperty(key);

  const dataProviderMode = process.env.DATA_PROVIDER?.trim().toLowerCase();
  if (dataProviderMode === "mock") {
    return NextResponse.json({
      ok: true,
      mode: "mock",
      message: "DATA_PROVIDER=mock is set, so every property runs on demo data regardless of GA4 configuration.",
    });
  }

  if (!isPropertyConfigured(property)) {
    return NextResponse.json({
      ok: false,
      mode: "mock",
      error:
        `GA4 property not configured for ${property.displayName}. Set ${property.ga4PropertyIdEnvVar} plus GA4 ` +
        "authentication (GOOGLE_APPLICATION_CREDENTIALS, or GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN) in .env. See README.md.",
    });
  }

  try {
    const { testGa4Connection } = (await import("@/lib/data-providers/ga4-provider")) as typeof import("@/lib/data-providers/ga4-provider");
    const result = await testGa4Connection(property);
    if (result.ok) {
      return NextResponse.json({ ok: true, mode: "ga4", message: `Connected to ${property.displayName}.` });
    }
    return NextResponse.json({
      ok: false,
      mode: "ga4",
      error: `Unable to authenticate with GA4 for ${property.displayName}: ${result.error}`,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      mode: "ga4",
      error: `Unable to authenticate with GA4 for ${property.displayName}: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
