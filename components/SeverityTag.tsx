import type { ChangeSeverity } from "@/lib/types";

const LABEL: Record<ChangeSeverity, string> = {
  MAJOR_DROP: "Major drop",
  DROP: "Drop",
  STABLE: "Stable",
  IMPROVED: "Improved",
};

export function SeverityTag({ severity }: { severity: ChangeSeverity }) {
  return <span className={`severity-${severity} text-[10px] font-semibold uppercase tracking-wide`}>{LABEL[severity]}</span>;
}
