import { NextResponse } from "next/server";
import { PROPERTIES, PROPERTY_KEYS } from "@/lib/properties";
import { isPropertyLive } from "@/lib/data-providers";
import { getPropertyId } from "@/lib/data-providers/ga4-config";

export const dynamic = "force-dynamic";

function maskPropertyId(id: string): string {
  if (!id) return "";
  if (id.length <= 4) return "*".repeat(id.length);
  return `${"*".repeat(id.length - 4)}${id.slice(-4)}`;
}

/** Lists all four properties with their connection status — never returns secrets, only a masked property ID. */
export async function GET() {
  const properties = PROPERTY_KEYS.map((key) => {
    const property = PROPERTIES[key];
    const propertyId = getPropertyId(property);
    return {
      key: property.key,
      displayName: property.displayName,
      brand: property.brand,
      platform: property.platform,
      ga4PropertyIdEnvVar: property.ga4PropertyIdEnvVar,
      propertyIdConfigured: !!propertyId,
      maskedPropertyId: propertyId ? maskPropertyId(propertyId) : null,
      live: isPropertyLive(property),
    };
  });
  return NextResponse.json({ properties });
}
