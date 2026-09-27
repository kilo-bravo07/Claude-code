"use client";

import { PROPERTIES, PROPERTY_KEYS } from "@/lib/properties";
import type { PropertyKey } from "@/lib/properties/types";

interface Props {
  value: PropertyKey;
  onChange: (value: PropertyKey) => void;
}

/** The dashboard's primary selector (spec section 2): one combined "Property" dropdown covering all four brand+platform combinations, so the user is never looking at numbers without a clear property context. */
export function PropertySelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-xs text-ink-500">Property</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PropertyKey)}
        className="rounded border border-ink-300 bg-white px-2 py-1.5 text-sm font-medium text-ink-900"
      >
        {PROPERTY_KEYS.map((key) => (
          <option key={key} value={key}>
            {PROPERTIES[key].displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
