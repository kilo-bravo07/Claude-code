export function LoadingPanel({ label = "Loading…" }: { label?: string }) {
  return <div className="rounded border border-ink-100 p-6 text-center text-xs text-ink-500">{label}</div>;
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded border border-drop-major/30 bg-red-50 p-4 text-xs text-drop-major">
      <div className="font-semibold">Couldn&apos;t load this section</div>
      <div className="mt-1 text-ink-700">{message}</div>
    </div>
  );
}

export function EmptyPanel({ message = "No data for the selected filters." }: { message?: string }) {
  return <div className="rounded border border-dashed border-ink-100 p-6 text-center text-xs text-ink-500">{message}</div>;
}
