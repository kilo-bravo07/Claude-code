"use client";

import { useEffect, useState } from "react";
import { LoadingPanel, ErrorPanel } from "@/components/StatePanels";

interface PropertyStatus {
  key: string;
  displayName: string;
  brand: string;
  platform: string;
  ga4PropertyIdEnvVar: string;
  propertyIdConfigured: boolean;
  maskedPropertyId: string | null;
  live: boolean;
}

type TestResult = { ok: boolean; mode?: string; message?: string; error?: string };

export default function SetupPage() {
  const [properties, setProperties] = useState<PropertyStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, TestResult>>({});

  useEffect(() => {
    fetch("/api/properties")
      .then((res) => res.json())
      .then((body) => setProperties(body.properties))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  async function testConnection(key: string) {
    setTesting((t) => ({ ...t, [key]: true }));
    try {
      const res = await fetch(`/api/properties/${key}/test-connection`, { method: "POST" });
      const body = await res.json();
      setResults((r) => ({ ...r, [key]: body }));
    } catch (err) {
      setResults((r) => ({ ...r, [key]: { ok: false, error: err instanceof Error ? err.message : String(err) } }));
    } finally {
      setTesting((t) => ({ ...t, [key]: false }));
    }
  }

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">GA4 property setup</h1>
        <p className="mt-1 text-sm text-ink-500">
          This dashboard supports four independent GA4 properties. Each connects (or not) on its own — one property
          can be live on GA4 while another still runs on demo data. Property IDs shown below are masked; secrets are
          never displayed. See README.md for full step-by-step setup instructions.
        </p>
      </div>

      {error && <ErrorPanel message={error} />}
      {!properties && !error && <LoadingPanel label="Loading property status…" />}

      {properties && (
        <div className="space-y-3">
          {properties.map((p) => {
            const result = results[p.key];
            return (
              <div key={p.key} className="rounded border border-ink-100 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-ink-900">{p.displayName}</div>
                    <div className="text-xs text-ink-500">
                      {p.brand} · {p.platform}
                    </div>
                  </div>
                  <span
                    className={`rounded px-2 py-1 text-[11px] font-medium ${
                      p.live ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {p.live ? "Connected" : "Not Connected"}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="text-ink-500">GA4 Property ID</div>
                  <div className="tabular-nums text-ink-900">{p.maskedPropertyId ?? "not set"}</div>
                  <div className="text-ink-500">Environment variable</div>
                  <div className="font-mono text-ink-700">{p.ga4PropertyIdEnvVar}</div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => testConnection(p.key)}
                    disabled={testing[p.key]}
                    className="rounded border border-ink-300 px-2.5 py-1 text-xs text-ink-700 hover:bg-ink-100 disabled:opacity-50"
                  >
                    {testing[p.key] ? "Testing…" : "Test Connection"}
                  </button>
                  {result && (
                    <span className={`text-xs ${result.ok ? "text-improve" : "text-drop-major"}`}>
                      {result.ok ? result.message ?? "Connected" : result.error ?? "Connection failed"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded border border-ink-100 bg-ink-100/40 p-3 text-xs text-ink-700">
        <div className="font-semibold text-ink-900">Quick setup steps</div>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          <li>Open Google Analytics for the property you want to connect (e.g. FlowerAura Web).</li>
          <li>Admin (gear icon, bottom left) → Property Settings → copy the numeric "Property ID".</li>
          <li>
            Paste it into <code>.env</code> as the matching variable above (e.g.{" "}
            <code>FLOWERAURA_WEB_GA4_PROPERTY_ID=123456789</code>).
          </li>
          <li>Repeat for each property you want to connect — you don't need all four at once.</li>
          <li>
            Set up GA4 authentication once (shared across all four properties) — see README.md "Connecting GA4" for
            the exact click-by-click steps for a Viewer-only Google account.
          </li>
          <li>Restart the app, then click "Test Connection" above for each property.</li>
        </ol>
      </div>
    </div>
  );
}
