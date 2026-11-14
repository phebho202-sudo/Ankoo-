import Link from "next/link";
import { GrantBadges, StateBadge } from "@/components/GrantBadges";
import { OriginalityForm, RightsCheckForm } from "@/components/RightsForms";
import { Alert, Card, PageHeader, buttonClass } from "@/components/ui";
import type { EpisodeSummary, LicenceSummary, RightsSummary } from "@/lib/api";
import { fmt, formatDate } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RightsPage() {
  const { locale, t } = await getI18n();
  const r = t.rights;
  const [sum, lics, eps] = await Promise.all([
    authedFetch<{ summary: RightsSummary }>("/api/v1/rights/summary"),
    authedFetch<{ licences: LicenceSummary[] }>("/api/v1/rights/licences"),
    authedFetch<{ episodes: EpisodeSummary[] }>("/api/v1/episodes?limit=100"),
  ]);
  if (!sum.ok || !lics.ok || !eps.ok) {
    return (
      <>
        <PageHeader title={t.nav.rights} />
        <Alert tone="error">{t.common.unreachable}</Alert>
      </>
    );
  }
  const s = sum.data.summary;
  const tiles: [keyof typeof r.summary, number, string][] = [
    ["active", s.active, "text-emerald-800"],
    ["draft", s.draft, "text-gold-600"],
    ["expiring_soon", s.expiring_soon, s.expiring_soon ? "text-red-800" : "text-navy"],
    ["expired", s.expired, s.expired ? "text-red-800" : "text-navy"],
    ["revoked", s.revoked, "text-navy"],
  ];

  return (
    <>
      <PageHeader
        title={t.nav.rights}
        subtitle={r.subtitle}
        badge={
          <Link href="/rights/new" className={buttonClass}>
            + {r.newLicence}
          </Link>
        }
      />
      <div className="mb-5">
        <Alert tone="warn">{r.disclaimer}</Alert>
      </div>
      <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map(([k, n, cls]) => (
          <div key={k} className="rounded-lg border border-navy-100/70 bg-white px-4 py-3 shadow-sm">
            <dt className="text-xs text-charcoal-400">{r.summary[k]}</dt>
            <dd className={`text-2xl font-semibold tabular-nums ${cls}`}>{n}</dd>
          </div>
        ))}
      </dl>

      <Card title={r.licences}>
        {lics.data.licences.length === 0 ? (
          <p className="text-sm text-charcoal-400">{r.none}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-navy-100 text-xs uppercase tracking-wider text-charcoal-400">
                <tr>
                  <th className="py-2 pr-4 font-medium">{r.colReference}</th>
                  <th className="py-2 pr-4 font-medium">{r.colScope}</th>
                  <th className="py-2 pr-4 font-medium">{r.colRights}</th>
                  <th className="py-2 pr-4 font-medium">{r.colPlatforms}</th>
                  <th className="py-2 pr-4 font-medium">{r.colExpires}</th>
                  <th className="py-2 font-medium">{r.colState}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {lics.data.licences.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="py-2 pr-4">
                      <Link href={`/rights/${l.id}`} className="font-medium text-navy underline decoration-gold/60 underline-offset-2">
                        {l.licence_reference}
                      </Link>
                      <div className="text-xs text-charcoal-400">{l.licensor_name}</div>
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {l.channel_title && <div>{fmt(r.wholeChannel, { channel: l.channel_title })}</div>}
                      {l.episode_count > 0 && <div>{fmt(r.episodesCount, { n: l.episode_count })}</div>}
                      {!l.channel_title && l.episode_count === 0 && <span className="text-charcoal-400">{r.noScope}</span>}
                    </td>
                    <td className="py-2 pr-4">
                      <GrantBadges t={r} grants={l} />
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {l.permitted_platforms.map((p) => (r.platformNames as Record<string, string>)[p] ?? p).join(", ") || "—"}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-xs tabular-nums">{formatDate(l.expires_at, locale)}</td>
                    <td className="py-2">
                      <StateBadge t={r} state={l.state} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card title={r.check}>
          <p className="-mt-2 mb-3 text-xs text-charcoal-400">{r.checkHelp}</p>
          {eps.data.episodes.length === 0 ? (
            <p className="text-sm text-charcoal-400">{t.episodes.none}</p>
          ) : (
            <RightsCheckForm t={r} episodes={eps.data.episodes} />
          )}
        </Card>
        <Card title={r.originality}>
          <p className="-mt-2 mb-3 text-xs text-charcoal-400">{fmt(r.originalityHelp, { n: 12 })}</p>
          <OriginalityForm t={r} />
        </Card>
      </div>
    </>
  );
}
