import { computeFunnel } from "@/lib/metrics";
import type { RawCounts } from "@/lib/types";
import type { PropertyConfig } from "@/lib/properties/types";
import { FunnelDiagram } from "./FunnelDiagram";

export function ShoppingFunnelViz({ property, counts }: { property: PropertyConfig; counts: RawCounts }) {
  return (
    <FunnelDiagram
      startLabel={property.shopping.root.label}
      startUsers={counts[property.shopping.root.key] ?? 0}
      stages={computeFunnel(property.shopping, counts)}
    />
  );
}

export function CheckoutFunnelViz({ property, counts }: { property: PropertyConfig; counts: RawCounts }) {
  return (
    <FunnelDiagram
      startLabel={property.checkout.root.label}
      startUsers={counts[property.checkout.root.key] ?? 0}
      stages={computeFunnel(property.checkout, counts)}
    />
  );
}
