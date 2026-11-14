import Link from "next/link";
import { setChannelActiveAction } from "@/app/content-actions";
import { Alert, Badge, Card, PageHeader, inputClass, secondaryButtonClass } from "@/components/ui";
import type { Channel, EpisodeSummary, Overview } from "@/lib/api";
import { fmt, formatDate, formatDateTime, formatDuration } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { authedFetch } from "@/lib/session";
import { AddChannelForm, ScanButton } from "./ChannelForms";

export const dynamic = "force-dynamic";
const PAGE = 25;
const STATUSES = ["discovered", "researched", "archived"] as const;

export default async function EpisodesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { locale, t } = await getI18n();
  const e = t.episodes;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = STATUSES.find((s) => s === sp.status);
  const q = (sp.q ?? "").slice(0, 200);
  const params = new URLSearchParams({ limit: String(PAGE), offset: String((page - 1) * PAGE) });
  if (status) params.set("status", status);
  if (q) params.set("q", q);

  const [channels, episodes, ov] = await Promise.all([
    authedFetch<{ channels: Channel[] }>("/api/v1/channels"),
    authedFetch<{ episodes: EpisodeSummary[]; total: number }>(`/api/v1/episodes?${params}`),
    authedFetch<Overview>("/api/v1/overview"),
  ]);
  if (!channels.ok || !episodes.ok) {
    return (
      <>
        <PageHeader title={t.nav.episodes} />
        <Alert tone="error">{t.common.unreachable}</Alert>
      </>
    );
  }
  const sampleMode = ov.ok && ov.data.provider_mode === "sample";
  const total = episodes.data.total;
  const pageLink = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (status) u.set("status", status);
    u.set("page", String(p));
    return `/episodes?${u}`;
  };

  return (
    <>
      <PageHeader title={t.nav.episodes} subtitle={e.subtitle} />
      {sampleMode && (
        <div className="mb-5">
          <Alert tone="warn">{e.sampleBanner}</Alert>
        </div>
      )}

      <Card title={e.channels}>
        {channels.data.channels.length === 0 ? (
          <p className="text-sm text-charcoal-400">{e.noChannels}</p>
        ) : (
          <ul className="divide-y divide-navy-50">
            {channels.data.channels.map((c) => (
              <li key={c.id} className="grid gap-3 py-4 md:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-navy">{c.title}</span>
                    {c.handle && <span className="text-xs text-charcoal-400">{c.handle}</span>}
                    {c.is_sample && <Badge tone="gold">{e.sample}</Badge>}
                    <Badge tone={c.authorisation_basis === "licensed" ? "navy" : "neutral"}>
                      {c.authorisation_basis === "licensed" ? e.basisLicensed : e.basisResearch}
                    </Badge>
                    {!c.is_active && <Badge tone="red">{e.paused}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-charcoal">“{c.authorisation_note}”</p>
                  <p className="mt-1 text-xs text-charcoal-400">
                    {fmt(e.videoCount, { n: c.episode_count })} ·{" "}
                    {c.last_scanned_at
                      ? fmt(e.lastScanned, { when: formatDateTime(c.last_scanned_at, locale) })
                      : e.neverScanned}
                  </p>
                </div>
                <div className="flex items-start gap-2 md:justify-end">
                  <ScanButton channelId={c.id} disabled={!c.is_active} label={e.scan} jobLabels={t.jobs} />
                  <form action={setChannelActiveAction}>
                    <input type="hidden" name="channel_id" value={c.id} />
                    <input type="hidden" name="active" value={String(!c.is_active)} />
                    <button type="submit" className={secondaryButtonClass}>
                      {c.is_active ? e.pause : e.resume}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6">
        <Card title={e.addChannel}>
          <AddChannelForm labels={e} />
        </Card>
      </div>

      <div className="mt-6">
        <Card title={e.list}>
          <form className="mb-4 flex flex-wrap gap-2" role="search">
            <input name="q" defaultValue={q} placeholder={e.search} aria-label={e.search} className={`${inputClass} max-w-xs`} />
            <select name="status" defaultValue={status ?? ""} aria-label={e.colStatus} className={`${inputClass} max-w-[12rem]`}>
              <option value="">{e.allStatuses}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {e.status[s]}
                </option>
              ))}
            </select>
            <button type="submit" className={secondaryButtonClass}>
              {e.filter}
            </button>
          </form>
          {episodes.data.episodes.length === 0 ? (
            <p className="text-sm text-charcoal-400">{e.none}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="border-b border-navy-100 text-xs uppercase tracking-wider text-charcoal-400">
                  <tr>
                    <th className="py-2 pr-4 font-medium">{e.colTitle}</th>
                    <th className="py-2 pr-4 font-medium">{e.colChannel}</th>
                    <th className="py-2 pr-4 font-medium">{e.colPublished}</th>
                    <th className="py-2 pr-4 font-medium">{e.colLength}</th>
                    <th className="py-2 pr-4 font-medium">{e.colTranscript}</th>
                    <th className="py-2 font-medium">{e.colStatus}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {episodes.data.episodes.map((ep) => (
                    <tr key={ep.id} className="align-top">
                      <td className="py-2 pr-4">
                        <Link href={`/episodes/${ep.id}`} className="font-medium text-navy underline decoration-gold/60 underline-offset-2 hover:decoration-gold">
                          {ep.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {ep.is_sample && <Badge tone="gold">{e.sample}</Badge>}
                          {ep.possible_duplicate_of_id && <Badge tone="red">{e.possibleDuplicate}</Badge>}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-xs text-charcoal-400">{ep.channel_title}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-xs tabular-nums">{formatDate(ep.published_at, locale)}</td>
                      <td className="py-2 pr-4 text-xs tabular-nums">{formatDuration(ep.duration_seconds)}</td>
                      <td className="py-2 pr-4 text-xs">{ep.has_transcript ? "✓" : "—"}</td>
                      <td className="py-2">
                        <Badge tone={ep.status === "researched" ? "green" : "neutral"}>{e.status[ep.status]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {total > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-charcoal-400">
                {fmt(e.showing, {
                  from: (page - 1) * PAGE + 1,
                  to: Math.min(page * PAGE, total),
                  total,
                })}
              </span>
              <span className="flex gap-4">
                {page > 1 && (
                  <Link className="font-medium text-navy underline decoration-gold underline-offset-4" href={pageLink(page - 1)}>
                    ← {e.prev}
                  </Link>
                )}
                {page * PAGE < total && (
                  <Link className="font-medium text-navy underline decoration-gold underline-offset-4" href={pageLink(page + 1)}>
                    {e.next} →
                  </Link>
                )}
              </span>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
