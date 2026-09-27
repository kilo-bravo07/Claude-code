"use client";

import { useEffect, useRef, useState } from "react";

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}

export function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const summary = selected.length === 0 ? "All" : selected.length <= 2 ? selected.join(", ") : `${selected.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex min-w-[9rem] items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-left text-xs ${
          selected.length ? "border-ink-700 bg-ink-900 text-white" : "border-ink-100 bg-white text-ink-700"
        }`}
      >
        <span className="truncate">
          <span className="opacity-70">{label}: </span>
          {summary}
        </span>
        <span className="opacity-60">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded border border-ink-100 bg-white p-1 shadow-lg">
          {options.length === 0 && <div className="px-2 py-1 text-xs text-ink-500">No options</div>}
          {options.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-ink-100">
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
