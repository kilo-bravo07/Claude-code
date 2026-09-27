"use client";

import { Suspense } from "react";
import { SEVERITY_THRESHOLDS, OVER_100_PERCENT_WARNING } from "@/lib/config";
import { PROPERTIES, PROPERTY_KEYS } from "@/lib/properties";
import { FILTER_LABELS } from "@/lib/properties/types";
import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { getProperty } from "@/lib/properties";
import { PropertySelector } from "@/components/PropertySelector";
import { LoadingPanel } from "@/components/StatePanels";
import type { FunnelDefinition } from "@/lib/properties/types";

function Formula({ name, formula }: { name: string; formula: string }) {
  return (
    <div className="rounded border border-ink-100 p-3">
      <div className="text-xs font-semibold text-ink-900">{name}</div>
      <div className="mt-1 font-mono text-xs text-ink-700">{formula}</div>
    </div>
  );
}

function funnelFormulas(funnel: FunnelDefinition) {
  const rows = funnel.stages.map((stage, i) => {
    const denominatorLabel = i === 0 ? funnel.root.label : funnel.stages[i - 1].label;
    return { name: stage.label, formula: `${stage.label} users / ${denominatorLabel} users` };
  });
  rows.push({ name: funnel.ecr.label, formula: funnel.ecr.description });
  return rows;
}

export default function DefinitionsPage() {
  return (
    <Suspense fallback={<LoadingPanel label="Loading…" />}>
      <DefinitionsContent />
    </Suspense>
  );
}

function DefinitionsContent() {
  const { property: propertyKey, setProperty } = useDashboardFilters();
  const property = getProperty(propertyKey);

  return (
    <div className="max-w-3xl space-y-8 pb-16 text-sm text-ink-700">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">Data definitions</h1>
        <p className="mt-1 text-ink-500">
          Every number in this dashboard is produced by the calculation layer in <code>lib/metrics.ts</code>, driven
          by this property&apos;s funnel definition in <code>lib/properties/*.ts</code> — this page documents exactly
          what each metric means for the property you have selected, so a number here always matches the same number
          computed anywhere else in the app.
        </p>
      </div>

      <div className="rounded border border-ink-100 bg-ink-100/40 p-3">
        <PropertySelector value={propertyKey} onChange={setProperty} />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">{property.displayName} — Shopping funnel</h2>
        <p className="text-ink-500">
          {property.shopping.root.label} → {property.shopping.stages.map((s) => s.label).join(" → ")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {funnelFormulas(property.shopping).map((f) => (
            <Formula key={f.name} name={f.name} formula={f.formula} />
          ))}
        </div>
        {property.additionalMetrics.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {property.additionalMetrics.map((m) => (
              <Formula key={m.key} name={m.label} formula={m.description} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">{property.displayName} — Checkout funnel</h2>
        <p className="text-ink-500">
          {property.checkout.root.label} → {property.checkout.stages.map((s) => s.label).join(" → ")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {funnelFormulas(property.checkout).map((f) => (
            <Formula key={f.name} name={f.name} formula={f.formula} />
          ))}
        </div>
        <p className="text-xs text-ink-500">
          Event names for every stage of both funnels are defined once, per property, in{" "}
          <code>lib/properties/{property.key}.ts</code> — nothing about a specific property&apos;s funnel is
          hardcoded in the UI or the calculation layer.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">Event mapping — all four properties</h2>
        <p className="text-ink-500">
          The four properties genuinely use different events and funnel shapes; nothing here is forced into one
          universal formula.
        </p>
        <div className="overflow-x-auto rounded border border-ink-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-100/40 text-left text-ink-500">
                <th className="px-2 py-1.5 font-medium">Property</th>
                <th className="px-2 py-1.5 font-medium">Shopping funnel (event names)</th>
                <th className="px-2 py-1.5 font-medium">Checkout funnel (event names)</th>
              </tr>
            </thead>
            <tbody>
              {PROPERTY_KEYS.map((key) => {
                const p = PROPERTIES[key];
                return (
                  <tr key={key} className="border-b border-ink-100 last:border-0 align-top">
                    <td className="px-2 py-1.5 font-medium text-ink-900">{p.displayName}</td>
                    <td className="px-2 py-1.5 font-mono text-ink-700">
                      {[p.shopping.root, ...p.shopping.stages].map((s) => s.ga4EventName).join(" → ")}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-ink-700">
                      {[p.checkout.root, ...p.checkout.stages].map((s) => s.ga4EventName).join(" → ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">Comparison logic</h2>
        <ul className="list-disc space-y-1 pl-5 text-ink-500">
          <li>
            <strong className="text-ink-700">D-7:</strong> the selected date/range shifted back exactly 7 days.
          </li>
          <li>
            <strong className="text-ink-700">D-365 (YoY):</strong> the selected date/range shifted back exactly 365
            days.
          </li>
          <li>
            <strong className="text-ink-700">pp change</strong> = current rate − comparison rate, in percentage
            points. <strong className="text-ink-700">Relative change</strong> = (current − comparison) / comparison,
            shown as a %. These are never interchangeable — the pp/% toggle in the filter bar switches which one is
            displayed.
          </li>
          <li>All comparisons sum raw user counts first, then compute the rate — rates are never averaged directly.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">Drop severity thresholds</h2>
        <p className="text-ink-500">
          Configured once in <code>lib/config.ts</code> (<code>SEVERITY_THRESHOLDS</code>), used identically across
          all four properties:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-ink-500">
          <li>Improved: change ≥ +{SEVERITY_THRESHOLDS.improvedPp} pp</li>
          <li>
            Stable: {SEVERITY_THRESHOLDS.dropPp} pp to +{SEVERITY_THRESHOLDS.improvedPp} pp
          </li>
          <li>Drop: change ≤ {SEVERITY_THRESHOLDS.dropPp} pp</li>
          <li>Major drop: change ≤ {SEVERITY_THRESHOLDS.majorDropPp} pp</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">Conversion rates above 100%</h2>
        <p className="text-ink-500">
          A funnel stage&apos;s rate is never capped at 100% and never silently corrected — some properties&apos;
          current GA4 reporting methodology genuinely produces a later step with more users than the step before it
          (notably Bakingo Web&apos;s checkout Step 1). This dashboard preserves the exact value your GA4 configuration
          produces and instead flags it in Data Quality:
        </p>
        <div className="rounded border border-amber-200 bg-amber-50 p-2 font-mono text-xs text-amber-800">
          {OVER_100_PERCENT_WARNING}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">City definitions</h2>
        <p className="text-ink-500">
          <strong className="text-ink-700">GA4 City</strong> is GA4&apos;s own geo-IP-derived city for the user/session
          — it reflects where the visitor was, not necessarily where the order was delivered.{" "}
          <strong className="text-ink-700">Delivery City</strong> (order destination) is a separate concept from a
          non-GA4 source and is <em>not currently wired up</em> for any property. The two are never conflated in this
          app. Not every property exposes a city filter — see <code>availableFilters</code> in each property&apos;s
          config (currently: App properties omit {FILTER_LABELS.ga4City}, since app installs don&apos;t reliably carry
          a usable GA4 city dimension by default).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">GA4 dimensions used</h2>
        <ul className="list-disc space-y-1 pl-5 text-ink-500">
          <li>device → GA4 &quot;deviceCategory&quot;</li>
          <li>country → GA4 &quot;country&quot;</li>
          <li>ga4City → GA4 &quot;city&quot;</li>
          <li>trafficSource / trafficMedium → GA4 &quot;sessionSource&quot; / &quot;sessionMedium&quot;</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">Data refresh</h2>
        <p className="text-ink-500">
          Every API response is cached in-memory for 5 minutes (30 minutes for filter option lists), keyed per
          property — see <code>lib/cache.ts</code> / <code>CACHE_TTL_MS</code> in <code>lib/config.ts</code>. This
          keeps repeated filter/property changes from re-hitting the GA4 API on every click while still refreshing
          within a session.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">Authentication &amp; environment variables</h2>
        <p className="text-ink-500">
          See README.md at the repo root — &quot;Connecting GA4&quot; — for the full list and setup steps, and the{" "}
          <a href="/setup" className="underline">
            Setup
          </a>{" "}
          page for live connection status per property.
        </p>
      </section>
    </div>
  );
}
