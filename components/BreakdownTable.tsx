import { formatPercent, formatPp, formatRelative } from "@/lib/metrics";
import type { ChangeUnit } from "@/hooks/useChangeUnit";
import type { BreakdownRow } from "@/lib/types";
import { SeverityTag } from "./SeverityTag";

interface Props {
  rows: BreakdownRow[];
  ecrKind: "shoppingEcr" | "checkoutEcr";
  unit: ChangeUnit;
  comparisonLabel: string;
  sortByDeterioration?: boolean;
  limit?: number;
  dimensionLabel: string;
}

export function BreakdownTable({ rows, ecrKind, unit, comparisonLabel, sortByDeterioration, limit, dimensionLabel }: Props) {
  const sorted = [...rows].sort((a, b) => {
    if (sortByDeterioration) {
      const ap = a[ecrKind].ppChange ?? Infinity;
      const bp = b[ecrKind].ppChange ?? Infinity;
      return ap - bp; // most negative (worst drop) first
    }
    return (b[ecrKind].currentValue ?? 0) - (a[ecrKind].currentValue ?? 0);
  });
  const visible = limit ? sorted.slice(0, limit) : sorted;

  if (visible.length === 0) {
    return <div className="rounded border border-dashed border-ink-100 p-4 text-center text-xs text-ink-500">No rows for the current filters.</div>;
  }

  return (
    <div className="overflow-x-auto rounded border border-ink-100">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-ink-100 bg-ink-100/40 text-left text-ink-500">
            <th className="px-2 py-1.5 font-medium">{dimensionLabel}</th>
            <th className="px-2 py-1.5 font-medium">Current ECR</th>
            <th className="px-2 py-1.5 font-medium">{comparisonLabel} ECR</th>
            <th className="px-2 py-1.5 font-medium">Change</th>
            <th className="px-2 py-1.5 font-medium">Users</th>
            <th className="px-2 py-1.5 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const change = row[ecrKind];
            return (
              <tr key={row.dimensionValue} className={`border-b border-ink-100 last:border-0 severity-bg-${change.severity}`}>
                <td className="px-2 py-1.5 text-ink-900">{row.dimensionValue}</td>
                <td className="px-2 py-1.5 tabular-nums">{formatPercent(change.currentValue)}</td>
                <td className="px-2 py-1.5 tabular-nums text-ink-500">{formatPercent(change.comparisonValue)}</td>
                <td className={`px-2 py-1.5 tabular-nums font-medium severity-${change.severity}`}>
                  {unit === "pp" ? formatPp(change.ppChange) : formatRelative(change.relativeChange)}
                </td>
                <td className="px-2 py-1.5 tabular-nums text-ink-500">{row.current.sessionStartUsers.toLocaleString()}</td>
                <td className="px-2 py-1.5">
                  <SeverityTag severity={change.severity} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
