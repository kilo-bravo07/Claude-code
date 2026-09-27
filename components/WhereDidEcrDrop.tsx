"use client";

import { useState } from "react";
import { DROP_TABLE_DEFAULT_ROWS, BREAKDOWN_DIMENSIONS } from "@/lib/config";
import type { BreakdownDimension } from "@/lib/types";
import { DimensionBreakdownSection } from "./DimensionBreakdownSection";

interface Props {
  ecrKind: "shoppingEcr" | "checkoutEcr";
  title?: string;
}

/** Spec section 7: "Where did ECR drop?" — sorted by deterioration vs the comparison period, not by lowest ECR. */
export function WhereDidEcrDrop({ ecrKind, title = "Where did ECR drop?" }: Props) {
  const [dimension, setDimension] = useState<BreakdownDimension>("ga4City");

  return (
    <section className="rounded border border-ink-100 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        <div className="flex gap-1">
          {BREAKDOWN_DIMENSIONS.map((d) => (
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
        dimensionLabel={BREAKDOWN_DIMENSIONS.find((d) => d.key === dimension)?.label ?? dimension}
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
