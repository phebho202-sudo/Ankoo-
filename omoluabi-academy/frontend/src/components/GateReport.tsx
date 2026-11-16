import type { GateCheck } from "@/lib/api";

/** One line per check: ✓/✗, the localised name, and whether it blocks or only advises. */
export function GateReport({ checks, names, advisory, notEnforced }: { checks: GateCheck[]; names: Record<string, string>; advisory: string; notEnforced: string }) {
  return (
    <ul className="space-y-1 text-sm">
      {checks.map((c) => {
        const detail = (c.detail ?? {}) as { enforced?: boolean };
        const note = !c.blocking ? (detail.enforced === false ? notEnforced : advisory) : null;
        return (
          <li key={c.code} className="flex items-start gap-2" data-check={c.code} data-ok={c.ok}>
            <span aria-hidden className={c.ok ? "text-emerald-700" : c.blocking ? "text-red-700" : "text-gold-600"}>{c.ok ? "✓" : "✗"}</span>
            <span>
              {names[c.code] ?? c.code}
              {note && <span className="ml-1 text-xs text-charcoal-400">({note})</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
