"use client";

import { useEffect, useState } from "react";
import { DROP_TABLE_DEFAULT_ROWS, BREAKDOWN_DIMENSIONS } from "@/lib/config";
import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { getProperty } from "@/lib/properties";
import type { BreakdownDimension } from "@/lib/types";
import { DimensionBreakdownSection } from "./DimensionBreakdownSection";

interface Props {
  ecrKind: "shoppingEcr" | "checkoutEcr";
  title?: string;
}

/** Spec: "Where did ECR drop?" — sorted by deterioration vs the comparison period, not by lowest ECR. Only shows dimension tabs this property's availableFilters actually support. */
export function WhereDidEcrDrop({ ecrKind, title = "Where did ECR drop?" }: Props) {
  const { property: propertyKey } = useDashboardFilters();
  const property = getProperty(propertyKey);
  const available = new Set(property.availableFilters);

  const dimensions = BREAKDOWN_DIMENSIONS.filter((d) =>
    d.key === "trafficSourceMedium"
      ? available.has("trafficSource") && available.has("trafficMedium")
      : available.has(d.key),
  );

  const [dimension, setDimension] = useState<BreakdownDimension>(dimensions[0]?.key ?? "country");

  useEffect(() => {
    if (!dimensions.some((d) => d.key === dimension)) setDimension(dimensions[0]?.key ?? "country");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyKey]);

  if (dimensions.length === 0) return null;

  return (
    <section className="rounded border border-ink-100 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        <div className="flex gap-1">
          {dimensions.map((d) => (
            <button
              key={d.key}
              onClick={() => setDimension(d.key)}
              className={`rounded px-2 py-1 text-[11px] ${
                dimension === d.key ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-100/70"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <DimensionBreakdownSection
        dimension={dimension}
        dimensionLabel={dimensions.find((d) => d.key === dimension)?.label ?? dimension}
        ecrKind={ecrKind}
        sortByDeterioration
        limit={DROP_TABLE_DEFAULT_ROWS}
      />
      <p className="mt-2 text-[11px] text-ink-500">
        Ranked by change vs. the comparison period (worst first) — this is deterioration, not just &quot;lowest ECR&quot;.
      </p>
    </section>
  );
}
