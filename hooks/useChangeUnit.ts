"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type ChangeUnit = "pp" | "relative";

/** Global pp-vs-relative-% display toggle (spec section 5), persisted in the URL like every other filter. */
export function useChangeUnit() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const unit: ChangeUnit = searchParams.get("unit") === "relative" ? "relative" : "pp";

  const setUnit = useCallback(
    (next: ChangeUnit) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("unit", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return useMemo(() => ({ unit, setUnit }), [unit, setUnit]);
}
