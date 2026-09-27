import { formatPercent, formatPp, formatRelative } from "@/lib/metrics";
import type { ChangeUnit } from "@/hooks/useChangeUnit";
import type { StageCardModel } from "@/lib/view-model";
import { SeverityTag } from "./SeverityTag";

function changeText(change: StageCardModel["vsD7"], unit: ChangeUnit): string {
  return unit === "pp" ? formatPp(change.ppChange) : formatRelative(change.relativeChange);
}

export function KpiCard({ stage, unit }: { stage: StageCardModel; unit: ChangeUnit }) {
  return (
    <div className={`rounded border border-ink-100 p-3 severity-bg-${stage.vsD7.severity}`}>
      <div className="text-xs font-medium text-ink-500">{stage.label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">{formatPercent(stage.rate)}</div>
      <div className="mt-0.5 text-[11px] text-ink-500 tabular-nums">
        {stage.numeratorUsers.toLocaleString()} / {stage.denominatorUsers.toLocaleString()} users
      </div>
      <div className="mt-2 space-y-1 border-t border-ink-100 pt-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-500">D-7</span>
          <span className={`severity-${stage.vsD7.severity} tabular-nums`}>{changeText(stage.vsD7, unit)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-500">YoY</span>
          <span className={`severity-${stage.vsD365.severity} tabular-nums`}>{changeText(stage.vsD365, unit)}</span>
        </div>
      </div>
      <div className="mt-2">
        <SeverityTag severity={stage.vsD7.severity} />
      </div>
    </div>
  );
}
