"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { parseFilterState } from "@/lib/query-state";
import { getProperty } from "@/lib/properties";

const TABS = [
  { href: "/overview", label: "ECR Overview" },
  { href: "/shopping", label: "Shopping" },
  { href: "/checkout", label: "Checkout" },
  { href: "/definitions", label: "Definitions" },
  { href: "/setup", label: "Setup" },
];

export function Nav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const property = getProperty(parseFilterState(searchParams).property);

  return (
    <header className="border-b border-ink-100">
      <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-tight text-ink-900">ECR Monitor</span>
          <span className="text-xs text-ink-500">/</span>
          <span className="text-sm font-medium text-ink-700">{property.displayName}</span>
        </div>
        <nav className="flex gap-1">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={qs ? `${tab.href}?${qs}` : tab.href}
                className={`rounded px-3 py-1.5 text-sm transition-colors ${
                  active ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-100"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
