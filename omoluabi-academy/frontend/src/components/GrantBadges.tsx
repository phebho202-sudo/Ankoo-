import { Badge } from "@/components/ui";
import type { GrantState, LicenceState } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const RIGHTS = ["translation", "adaptation", "commercial", "distribution"] as const;

export function GrantBadges({ t, grants }: { t: Dictionary["rights"]; grants: Record<(typeof RIGHTS)[number], GrantState> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {RIGHTS.map((r) => (
        <span key={r} title={`${t.rightNames[r]}: ${t.grant[grants[r]]}`}>
          <Badge tone={grants[r] === "granted" ? "green" : grants[r] === "unclear" ? "gold" : "red"}>
            {grants[r] === "granted" ? "✓" : grants[r] === "unclear" ? "?" : "✕"} {t.rightNames[r]}
          </Badge>
        </span>
      ))}
    </div>
  );
}

export function StateBadge({ t, state }: { t: Dictionary["rights"]; state: LicenceState }) {
  const tone = state === "active" ? "green" : state === "draft" || state === "not_yet_effective" ? "gold" : "red";
  return <Badge tone={tone}>{t.state[state]}</Badge>;
}
