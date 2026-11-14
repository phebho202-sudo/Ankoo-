export function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
        ok ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"
      }`}
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-600" : "bg-red-600"}`} />
      {label}: {ok ? "OK" : "DOWN"}
    </span>
  );
}
