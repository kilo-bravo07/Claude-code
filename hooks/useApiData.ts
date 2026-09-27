"use client";

import { useEffect, useRef, useState } from "react";

export type FetchState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "error"; data: null; error: string }
  | { status: "success"; data: T; error: null };

/** Generic fetch-with-abort hook. Re-fetches whenever `path` changes (path should embed all query params). */
export function useApiData<T>(path: string | null): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({ status: "loading", data: null, error: null });
  const requestId = useRef(0);

  useEffect(() => {
    if (!path) return;
    const id = ++requestId.current;
    const controller = new AbortController();
    setState({ status: "loading", data: null, error: null });

    fetch(path, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
        return body as T;
      })
      .then((data) => {
        if (requestId.current === id) setState({ status: "success", data, error: null });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (requestId.current === id) {
          setState({ status: "error", data: null, error: err instanceof Error ? err.message : String(err) });
        }
      });

    return () => controller.abort();
  }, [path]);

  return state;
}
