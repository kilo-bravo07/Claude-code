import { formatPercent } from "@/lib/metrics";
import type { FunnelStageResult } from "@/lib/types";

interface Props {
  startLabel: string;
  startUsers: number;
  stages: FunnelStageResult[];
}

/** Simple horizontal funnel: each bar's width is proportional to its user count relative to the funnel's first stage. */
export function FunnelDiagram({ startLabel, startUsers, stages }: Props) {
  const maxUsers = Math.max(startUsers, ...stages.map((s) => s.numeratorUsers));

  const steps = [
    { label: startLabel, users: startUsers, rate: null as number | null },
    ...stages.map((s) => ({ label: s.label, users: s.numeratorUsers, rate: s.rate })),
  ];

  return (
    <div className="space-y-1.5">
      {steps.map((step) => (
        <div key={step.label} className="flex items-center gap-2">
          <div className="w-24 shrink-0 text-xs text-ink-500">{step.label}</div>
          <div className="h-6 flex-1 rounded bg-ink-100">
            <div
              className="h-6 rounded bg-ink-700"
              style={{ width: maxUsers ? `${Math.max(2, (step.users / maxUsers) * 100)}%` : "0%" }}
            />
          </div>
          <div className="w-16 shrink-0 text-right text-xs tabular-nums text-ink-900">{step.users.toLocaleString()}</div>
          <div className="w-14 shrink-0 text-right text-xs tabular-nums text-ink-500">
            {step.rate === null ? "" : formatPercent(step.rate)}
          </div>
        </div>
      ))}
    </div>
  );
}
