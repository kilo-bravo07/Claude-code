import { computeCheckoutFunnel, computeShoppingFunnel } from "@/lib/metrics";
import type { FunnelCounts } from "@/lib/types";
import { FunnelDiagram } from "./FunnelDiagram";

export function ShoppingFunnelViz({ counts }: { counts: FunnelCounts }) {
  return <FunnelDiagram startLabel="Session Start" startUsers={counts.sessionStartUsers} stages={computeShoppingFunnel(counts)} />;
}

export function CheckoutFunnelViz({ counts }: { counts: FunnelCounts }) {
  return (
    <FunnelDiagram
      startLabel="Begin Checkout"
      startUsers={counts.beginCheckoutUsers}
      stages={computeCheckoutFunnel(counts)}
    />
  );
}
