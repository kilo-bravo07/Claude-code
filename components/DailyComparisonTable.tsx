import { computeCheckoutFunnel, computeShoppingFunnel, compareRates, formatPercent } from "@/lib/metrics";
import { computeCheckoutEcr, computeShoppingEcr } from "@/lib/metrics";
import type { DailyTrendPoint } from "@/lib/types";

interface Props {
  points: DailyTrendPoint[];
  comparisonPoints: DailyTrendPoint[] | null;
  comparisonLabel: string;
  funnel: "shopping" | "checkout";
}

export function DailyComparisonTable({ points, comparisonPoints, comparisonLabel, funnel }: Props) {
  const computeFn = funnel === "shopping" ? computeShoppingFunnel : computeCheckoutFunnel;
  const ecrFn = funnel === "shopping" ? computeShoppingEcr : computeCheckoutEcr;

  const rows = [...points].reverse();
  const comparisonByDate = new Map(comparisonPoints?.map((p, i) => [points[i]?.date, p]) ?? []);

  return (
    <div className="overflow-x-auto rounded border border-ink-100">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-ink-100 bg-ink-100/40 text-left text-ink-500">
            <th className="px-2 py-1.5 font-medium">Date</th>
            {computeFn({
              sessionStartUsers: 0,
              viewItemUsers: 0,
              addToCartUsers: 0,
              beginCheckoutUsers: 0,
              checkoutStep2Users: 0,
              checkoutStep3Users: 0,
              checkoutStep4Users: 0,
              checkoutStep5Users: 0,
              purchaseUsers: 0,
              revenue: 0,
              transactions: 0,
            }).map((s) => (
              <th key={s.key} className="px-2 py-1.5 font-medium">
                {s.label}
              </th>
            ))}
            <th className="px-2 py-1.5 font-medium">ECR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((point) => {
            const stages = computeFn(point.counts);
            const comparison = comparisonByDate.get(point.date);
            const comparisonStages = comparison ? computeFn(comparison.counts) : null;
            const ecr = ecrFn(point.counts);
            const ecrChange = compareRates(ecr, comparison ? ecrFn(comparison.counts) : null);
            return (
              <tr key={point.date} className="border-b border-ink-100 last:border-0">
                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-ink-700">{point.date}</td>
                {stages.map((s, i) => {
                  const change = compareRates(s.rate, comparisonStages?.[i]?.rate ?? null);
                  return (
                    <td key={s.key} className={`px-2 py-1.5 tabular-nums severity-bg-${change.severity}`}>
                      <span className={`severity-${change.severity}`}>{formatPercent(s.rate)}</span>
                    </td>
                  );
                })}
                <td className={`px-2 py-1.5 tabular-nums font-medium severity-bg-${ecrChange.severity}`}>
                  <span className={`severity-${ecrChange.severity}`}>{formatPercent(ecr)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {comparisonPoints && <div className="border-t border-ink-100 px-2 py-1 text-[11px] text-ink-500">Cell shading compares each day to its {comparisonLabel} counterpart.</div>}
    </div>
  );
}
