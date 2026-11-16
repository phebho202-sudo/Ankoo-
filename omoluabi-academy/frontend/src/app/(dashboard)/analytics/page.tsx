import Link from "next/link";
import { SyncButton } from "@/components/SyncButton";
import { Alert, Card, PageHeader } from "@/components/ui";
import type { AnalyticsReport } from "@/lib/api";
import { fmt } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { formatMoney, NUM } from "@/lib/money";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";
const PERIODS = [30, 90, 365];

function Tile({ title, value, note, testId }: { title: string; value: string; note?: string; testId?: string }) {
  return (
    <div className="rounded-lg border border-navy-100 bg-white p-4" data-testid={testId}>
      <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-400">{title}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-navy">{value}</p>
      {note && <p className="mt-1 text-xs text-charcoal-400">{note}</p>}
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = PERIODS.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const { locale, t } = await getI18n();
  const a = t.stats;
  const res = await authedFetch<AnalyticsReport>(`/api/v1/analytics?days=${days}`);
  if (!res.ok) return (<><PageHeader title={t.nav.analytics} /><Alert tone="error">{t.common.unreachable}</Alert></>);
  const r = res.data;
  const usd = (v: string | null) => (v === null ? "–" : formatMoney(Math.round(Number(v) * 100), "USD", locale));
  const yt = r.totals.estimated_revenue_minor;
  const sources = t.money.sources as Record<string, string>;
  const currencies = Object.keys(r.revenue);
  const maxMonth = Math.max(1, ...r.monthly.map((m) => Number(m.cost_usd ?? 0) * 100), ...r.monthly.flatMap((m) => Object.values(m.revenue)));

  return (
    <>
      <PageHeader title={t.nav.analytics} subtitle={a.subtitle} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-navy">{a.period}:</span>
        {PERIODS.map((p) => (
          <Link key={p} href={`/analytics?days=${p}`} className={`rounded-md border px-3 py-1 text-sm ${p === days ? "border-navy bg-navy text-cream" : "border-navy-100 bg-white text-navy"}`}>
            {fmt(a.days, { n: p })}
          </Link>
        ))}
        <span className="ml-auto"><SyncButton text={a.sync} ok={a.syncQueued} /></span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile title={a.views} value={r.totals.views.toLocaleString("en-NG")} testId="tile-views" />
        <Tile title={a.watchHours} value={NUM(r.totals.watch_hours)} />
        <Tile title={a.subscribers} value={r.totals.subscribers_gained.toLocaleString("en-NG")} />
        <Tile title={a.ytRevenue} value={yt === null ? a.notReported : formatMoney(yt, "USD", locale)} note={r.youtube_revenue_reported ? undefined : a.notReportedHelp} testId="tile-yt-revenue" />
        {currencies.length === 0 && <Tile title={fmt(a.revenueTotal, { currency: "" }).replace(" ()", "")} value="–" note={a.noRevenue} testId="tile-revenue" />}
        {currencies.map((c) => (
          <Tile key={c} title={fmt(a.revenueTotal, { currency: c })} value={formatMoney(r.revenue[c].total, c, locale)} testId={`tile-revenue-${c}`}
            note={Object.entries(r.revenue[c].by_source).map(([k, v]) => `${sources[k] ?? k}: ${formatMoney(v, c, locale)}`).join(" · ")} />
        ))}
        <Tile title={a.costs} value={usd(r.cost_usd)} testId="tile-costs" />
        <Tile title={a.net} value={usd(r.net_usd)} note={a.netHelp} />
        <Tile title={a.perVideo} value={usd(r.cost_per_approved_video_usd)} note={r.approved_videos ? undefined : a.noVideoYet} />
      </div>
      {r.estimates_included && <p className="mt-2 text-xs text-charcoal-400">{a.estimatesNote}</p>}

      <div className="mt-6 grid gap-5">
        <Card title={a.videos}>
          {r.videos.length === 0 ? <p className="text-sm text-charcoal-400" data-testid="no-videos">{a.noVideos}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="text-left text-xs text-charcoal-400"><th className="py-1">{a.colVideo}</th><th>{a.colViews}</th><th>{a.colWatch}</th><th>{a.colAvg}</th><th>{a.colEngagement}</th><th>{a.colRevenue}</th><th>{a.colRpm}</th></tr></thead>
                <tbody>
                  {r.videos.map((v) => (
                    <tr key={v.publication_id} className="border-t border-navy-50">
                      <td className="py-1.5" lang="yo">{v.url ? <a href={v.url} className="underline decoration-gold" target="_blank" rel="noopener noreferrer">{v.title}</a> : v.title} <span className="text-xs text-charcoal-400">{(t.videos.platformNames as Record<string, string>)[v.destination]}</span></td>
                      <td className="tabular-nums">{v.views.toLocaleString("en-NG")}</td>
                      <td className="tabular-nums">{NUM(v.watch_hours)}</td>
                      <td className="tabular-nums">{v.avg_view_seconds ? `${v.avg_view_seconds} s` : "–"}</td>
                      <td className="tabular-nums">{v.engagement_rate_percent ? `${v.engagement_rate_percent}%` : "–"}</td>
                      <td className="tabular-nums">{v.estimated_revenue_minor === null ? a.notReported : `${formatMoney(v.estimated_revenue_minor, "USD", locale)}${v.revenue_complete ? "" : ` (${a.partial})`}`}</td>
                      <td className="tabular-nums">{v.rpm ? formatMoney(Math.round(Number(v.rpm) * 100), "USD", locale) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title={a.monthly}>
            {r.monthly.length === 0 ? <p className="text-sm text-charcoal-400">{a.noMonthly}</p> : (
              <ul className="space-y-3 text-sm" data-testid="monthly">
                {r.monthly.map((mo) => (
                  <li key={mo.month}>
                    <p className="font-medium">{mo.month}</p>
                    {Object.entries(mo.revenue).map(([c, v]) => (
                      <div key={c} className="mt-1 flex items-center gap-2">
                        <span className="w-24 shrink-0 tabular-nums text-xs">{formatMoney(v, c, locale)}</span>
                        <span className="h-2 rounded bg-gold" style={{ width: `${Math.max(2, (v / maxMonth) * 100)}%` }} aria-hidden />
                      </div>
                    ))}
                    <p className="mt-1 text-xs text-charcoal-400">{a.colCost}: {usd(mo.cost_usd)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={a.affiliates}>
            {r.affiliates.length === 0 ? <p className="text-sm text-charcoal-400">{t.money.noLinks}</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="affiliate-table">
                  <thead><tr className="text-left text-xs text-charcoal-400"><th className="py-1">{t.money.name}</th><th>{a.colClicks}</th><th>{a.colConversions}</th><th>{a.colRate}</th><th>{a.colEpc}</th></tr></thead>
                  <tbody>
                    {r.affiliates.map((l) => (
                      <tr key={l.id} className="border-t border-navy-50" data-affiliate={l.slug}>
                        <td className="py-1.5">{l.name}</td>
                        <td className="tabular-nums">{l.clicks}</td>
                        <td className="tabular-nums">{l.conversions}</td>
                        <td className="tabular-nums">{l.conversion_rate_percent ? `${l.conversion_rate_percent}%` : "–"}</td>
                        <td className="tabular-nums">{Object.entries(l.epc).map(([c, v]) => (v === null ? "–" : formatMoney(Math.round(Number(v) * 100), c, locale))).join(" · ") || "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        <Card title={a.pipeline}>
          {r.orders.length + r.sponsorships.length === 0 ? <p className="text-sm text-charcoal-400">{a.noPipeline}</p> : (
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {r.orders.map((o) => <li key={`o-${o.status}-${o.currency}`}>{t.money.orders}: {(t.money.orderStatus as Record<string, string>)[o.status]} × {o.count} · {formatMoney(o.amount_minor, o.currency, locale)}</li>)}
              {r.sponsorships.map((s) => <li key={`s-${s.status}-${s.currency}`}>{t.money.sponsorships}: {(t.money.sponsorStatus as Record<string, string>)[s.status]} × {s.count} · {formatMoney(s.value_minor, s.currency, locale)}</li>)}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
