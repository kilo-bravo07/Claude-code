"use client";

import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { useApiData } from "@/hooks/useApiData";
import { toApiQueryString } from "@/lib/query-state";
import type { DataQualityResponse } from "@/lib/api-types";
import type { DataQualitySeverity } from "@/lib/types";
import { LoadingPanel, ErrorPanel } from "./StatePanels";

const SEVERITY_STYLE: Record<DataQualitySeverity, string> = {
  ok: "text-improve",
  warning: "text-warn",
  critical: "text-drop-major",
};

const SEVERITY_LABEL: Record<DataQualitySeverity, string> = {
  ok: "OK",
  warning: "Warning",
  critical: "Critical",
};

export function DataQualityPanel() {
  const filterState = useDashboardFilters();
  const qs = toApiQueryString(filterState);
  const state = useApiData<DataQualityResponse>(`/api/data-quality?${qs}`);

  if (state.status === "loading") return <LoadingPanel label="Checking data quality…" />;
  if (state.status === "error") return <ErrorPanel message={state.error} />;

  const { checks } = state.data;
  const worst = checks.some((c) => c.severity === "critical")
    ? "critical"
    : checks.some((c) => c.severity === "warning")
      ? "warning"
      : "ok";

  return (
    <section className="rounded border border-ink-100 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-900">Data quality status</h3>
        <span className={`text-xs font-semibold ${SEVERITY_STYLE[worst]}`}>
          {worst === "ok" ? "All checks passing" : `${SEVERITY_LABEL[worst]} issue(s) found`}
        </span>
      </div>
      <ul className="divide-y divide-ink-100">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2 py-1.5 text-xs">
            <span className={`mt-0.5 shrink-0 font-semibold ${SEVERITY_STYLE[check.severity]}`}>
              {SEVERITY_LABEL[check.severity]}
            </span>
            <div>
              <div className="text-ink-900">{check.label}</div>
              <div className="text-ink-500">{check.message}</div>
            </div>
          </li>
        ))}
      </ul>
      {worst !== "ok" && (
        <p className="mt-2 rounded bg-amber-50 p-2 text-[11px] text-amber-800">
          When a check above is flagged, treat any related ECR movement as a possible tracking/data issue first —
          verify before reporting it as a real business change.
        </p>
      )}
    </section>
  );
}
