"use client";

import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { useChangeUnit } from "@/hooks/useChangeUnit";
import { useApiData } from "@/hooks/useApiData";
import { MultiSelect } from "./MultiSelect";
import { PropertySelector } from "./PropertySelector";
import { addDays, today } from "@/lib/date-utils";
import { getProperty } from "@/lib/properties";
import { FILTER_LABELS } from "@/lib/properties/types";
import type { FilterOptionsResponse } from "@/lib/api-types";
import type { ComparisonMode } from "@/lib/types";

const COMPARISON_OPTIONS: { value: ComparisonMode; label: string }[] = [
  { value: "d7", label: "vs D-7" },
  { value: "d365", label: "vs D-365 (YoY)" },
  { value: "none", label: "No comparison" },
];

export function FilterBar() {
  const { property: propertyKey, range, filters, comparisonMode, setProperty, setRange, setComparisonMode, setFilterValues, resetFilters } =
    useDashboardFilters();
  const property = getProperty(propertyKey);
  const { unit, setUnit } = useChangeUnit();
  const optionsState = useApiData<FilterOptionsResponse>(`/api/filter-options?property=${propertyKey}`);
  const options = optionsState.status === "success" ? optionsState.data : null;

  const hasActiveFilters = Object.values(filters).some((v) => v?.length);
  const isSingleDay = range.start === range.end;
  const available = new Set(property.availableFilters);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded border border-ink-100 bg-ink-100/40 p-3">
      <PropertySelector value={propertyKey} onChange={setProperty} />

      <div className="h-5 w-px bg-ink-100" />

      <div className="flex items-center gap-1.5">
        <label className="text-xs text-ink-500">From</label>
        <input
          type="date"
          value={range.start}
          max={today()}
          onChange={(e) => setRange({ start: e.target.value, end: isSingleDay ? e.target.value : range.end })}
          className="rounded border border-ink-100 px-2 py-1 text-xs"
        />
        <label className="text-xs text-ink-500">To</label>
        <input
          type="date"
          value={range.end}
          max={today()}
          min={range.start}
          onChange={(e) => setRange({ start: range.start, end: e.target.value })}
          className="rounded border border-ink-100 px-2 py-1 text-xs"
        />
      </div>

      <div className="flex gap-1">
        <button
          className="rounded border border-ink-100 px-2 py-1 text-xs hover:bg-white"
          onClick={() => setRange({ start: today(), end: today() })}
        >
          Today
        </button>
        <button
          className="rounded border border-ink-100 px-2 py-1 text-xs hover:bg-white"
          onClick={() => setRange({ start: addDays(today(), -1), end: addDays(today(), -1) })}
        >
          Yesterday
        </button>
        <button
          className="rounded border border-ink-100 px-2 py-1 text-xs hover:bg-white"
          onClick={() => setRange({ start: addDays(today(), -6), end: today() })}
        >
          Last 7 days
        </button>
      </div>

      <select
        value={comparisonMode}
        onChange={(e) => setComparisonMode(e.target.value as ComparisonMode)}
        className="rounded border border-ink-100 px-2 py-1.5 text-xs"
      >
        {COMPARISON_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <div className="h-5 w-px bg-ink-100" />

      {/* Only render a filter control this property actually declares support for (spec section 15) — a
          disabled/missing dimension is hidden entirely rather than shown broken. */}
      {available.has("ga4City") && (
        <MultiSelect
          label={FILTER_LABELS.ga4City}
          options={options?.ga4Cities ?? []}
          selected={filters.ga4City ?? []}
          onChange={(v) => setFilterValues("ga4City", v)}
        />
      )}
      {available.has("country") && (
        <MultiSelect
          label={FILTER_LABELS.country}
          options={options?.countries ?? []}
          selected={filters.country ?? []}
          onChange={(v) => setFilterValues("country", v)}
        />
      )}
      {available.has("device") && (
        <MultiSelect
          label={FILTER_LABELS.device}
          options={options?.devices ?? []}
          selected={filters.device ?? []}
          onChange={(v) => setFilterValues("device", v)}
        />
      )}
      {available.has("trafficSource") && (
        <MultiSelect
          label="Source"
          options={options?.trafficSources ?? []}
          selected={filters.trafficSource ?? []}
          onChange={(v) => setFilterValues("trafficSource", v)}
        />
      )}
      {available.has("trafficMedium") && (
        <MultiSelect
          label="Medium"
          options={options?.trafficMediums ?? []}
          selected={filters.trafficMedium ?? []}
          onChange={(v) => setFilterValues("trafficMedium", v)}
        />
      )}

      {hasActiveFilters && (
        <button onClick={resetFilters} className="rounded border border-ink-300 px-2 py-1 text-xs text-ink-700 hover:bg-white">
          Reset filters
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {options && (
          <span
            className={`rounded px-2 py-1 text-[11px] font-medium ${
              options.mode === "mock" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {options.mode === "mock" ? "Demo Data" : "GA4 Live"}
          </span>
        )}
        <div className="flex rounded border border-ink-100 text-xs">
          <button
            onClick={() => setUnit("pp")}
            className={`px-2 py-1 ${unit === "pp" ? "bg-ink-900 text-white" : "text-ink-700"}`}
          >
            pp
          </button>
          <button
            onClick={() => setUnit("relative")}
            className={`px-2 py-1 ${unit === "relative" ? "bg-ink-900 text-white" : "text-ink-700"}`}
          >
            %
          </button>
        </div>
      </div>
    </div>
  );
}
