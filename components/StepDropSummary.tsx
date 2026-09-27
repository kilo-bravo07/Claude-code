import type { StageCardModel } from "@/lib/view-model";
import { formatPp } from "@/lib/metrics";
import { SeverityTag } from "./SeverityTag";

/** Spec: "Which checkout step dropped?" / "Which shopping funnel stage dropped?" — a direct answer, not just cards to scan. */
export function StepDropSummary({ stages, comparisonLabel }: { stages: StageCardModel[]; comparisonLabel: string }) {
  const drops = stages
    .filter((s) => s.vsD7.severity === "DROP" || s.vsD7.severity === "MAJOR_DROP")
    .sort((a, b) => (a.vsD7.ppChange ?? 0) - (b.vsD7.ppChange ?? 0));

  if (drops.length === 0) {
    return (
      <div className="rounded border border-ink-100 bg-emerald-50 p-3 text-xs text-improve">
        No stage deteriorated vs {comparisonLabel}.
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded border border-ink-100 p-3">
      {drops.map((s) => (
        <div key={s.key} className="flex items-center justify-between text-xs">
          <span className="text-ink-900">{s.label}</span>
          <span className="flex items-center gap-2">
            <span className={`severity-${s.vsD7.severity} tabular-nums font-medium`}>{formatPp(s.vsD7.ppChange)}</span>
            <SeverityTag severity={s.vsD7.severity} />
          </span>
        </div>
      ))}
    </div>
  );
}
