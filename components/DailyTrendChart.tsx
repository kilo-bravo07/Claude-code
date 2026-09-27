"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { computeMetric } from "@/lib/metrics";
import type { DailyTrendPoint } from "@/lib/types";
import type { MetricDefinition } from "@/lib/properties/types";

interface Props {
  points: DailyTrendPoint[];
  comparisonPoints: DailyTrendPoint[] | null;
  comparisonLabel: string;
  metricLabel: string;
  metric: MetricDefinition;
}

export function DailyTrendChart({ points, comparisonPoints, comparisonLabel, metricLabel, metric }: Props) {
  const data = points.map((p, i) => ({
    date: p.date.slice(5),
    current: computeMetric(metric, p.counts),
    comparison: comparisonPoints?.[i] ? computeMetric(metric, comparisonPoints[i].counts) : null,
  }));

  const values = data.flatMap((d) => [d.current, d.comparison]).filter((v): v is number => v !== null);
  const domain: [number, number] =
    values.length > 0 ? [Math.max(0, Math.min(...values) - 1), Math.max(...values) + 1] : [0, 100];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e9ec" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9aa1ad" />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke="#9aa1ad"
          domain={domain}
          tickFormatter={(value: number) => `${value.toFixed(1)}%`}
          width={52}
        />
        <Tooltip
          formatter={((value: unknown) =>
            value === null || value === undefined ? "—" : `${Number(value).toFixed(2)}%`) as never}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="current"
          name={metricLabel}
          stroke="#111418"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        {comparisonPoints && (
          <Line
            type="monotone"
            dataKey="comparison"
            name={comparisonLabel}
            stroke="#9aa1ad"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            connectNulls
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
