import { SEVERITY_THRESHOLDS } from "@/lib/config";

function Formula({ name, formula }: { name: string; formula: string }) {
  return (
    <div className="rounded border border-ink-100 p-3">
      <div className="text-xs font-semibold text-ink-900">{name}</div>
      <div className="mt-1 font-mono text-xs text-ink-700">{formula}</div>
    </div>
  );
}

export default function DefinitionsPage() {
  return (
    <div className="max-w-3xl space-y-8 pb-16 text-sm text-ink-700">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">Data definitions</h1>
        <p className="mt-1 text-ink-500">
          Every number in this dashboard is produced by the calculation layer in <code>lib/metrics.ts</code> — this
          page documents exactly what each metric means so a number here always matches the same number computed
          anywhere else in the app.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">Shopping funnel</h2>
        <p className="text-ink-500">Session Start → View Item → Add to Cart → Begin Checkout → Purchase.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Formula name="View Item %" formula="View Item users / Session Start users" />
          <Formula name="Add to Cart %" formula="Add to Cart users / View Item users" />
          <Formula name="Checkout %" formula="Begin Checkout users / Add to Cart users" />
          <Formula name="Purchase %" formula="Purchase users / Begin Checkout users" />
          <Formula name="Shopping ECR" formula="Purchase users / Session Start users" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">Checkout funnel</h2>
        <p className="text-ink-500">Begin Checkout → Step 2 → Step 3 → Step 4 → Step 5 → Purchase.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Formula name="Step 2 conversion" formula="Step 2 users / Begin Checkout users" />
          <Formula name="Step 3 conversion" formula="Step 3 users / Step 2 users" />
          <Formula name="Step 4 conversion" formula="Step 4 users / Step 3 users" />
          <Formula name="Step 5 conversion" formula="Step 5 users / Step 4 users" />
          <Formula name="Purchase conversion" formula="Purchase users / Step 5 users" />
          <Formula name="Checkout ECR" formula="Purchase users / Begin Checkout users" />
        </div>
        <p className="text-xs text-ink-500">
          Steps 2–5 are not standard GA4 ecommerce events — they map to whatever custom checkout-progress events your
          GTM/gtag implementation fires. Configure the exact event names via <code>GA4_EVENT_CHECKOUT_STEP2..5</code>{" "}
          in <code>.env</code> (see README).
        </p>
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
          Configured once in <code>lib/config.ts</code> (<code>SEVERITY_THRESHOLDS</code>), used everywhere a change is
          classified:
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
        <h2 className="text-sm font-semibold text-ink-900">City definitions</h2>
        <p className="text-ink-500">
          <strong className="text-ink-700">GA4 City</strong> is GA4&apos;s own geo-IP-derived city for the user/session
          — it reflects where the visitor was, not necessarily where the order was delivered.{" "}
          <strong className="text-ink-700">Delivery City</strong> (order destination) is a separate concept from a
          non-GA4 source and is <em>not currently wired up</em> — the data model reserves a nullable{" "}
          <code>deliveryCity</code> field for it so it can be added later without restructuring the dashboard. The two
          are never conflated in this app.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">GA4 dimensions used</h2>
        <ul className="list-disc space-y-1 pl-5 text-ink-500">
          <li>platform → GA4 &quot;platform&quot;</li>
          <li>device → GA4 &quot;deviceCategory&quot;</li>
          <li>country → GA4 &quot;country&quot;</li>
          <li>ga4City → GA4 &quot;city&quot;</li>
          <li>trafficSource / trafficMedium → GA4 &quot;sessionSource&quot; / &quot;sessionMedium&quot;</li>
          <li>brand → an optional custom dimension you configure via GA4_BRAND_DIMENSION (unset by default)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">Data refresh</h2>
        <p className="text-ink-500">
          Every API response is cached in-memory for 5 minutes (30 minutes for filter option lists) — see{" "}
          <code>lib/cache.ts</code> / <code>CACHE_TTL_MS</code> in <code>lib/config.ts</code>. This keeps repeated
          filter changes from re-hitting the GA4 API on every click while still refreshing within a session.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">Authentication &amp; environment variables</h2>
        <p className="text-ink-500">See README.md at the repo root — &quot;Connecting GA4&quot; — for the full list and setup steps.</p>
      </section>
    </div>
  );
}
