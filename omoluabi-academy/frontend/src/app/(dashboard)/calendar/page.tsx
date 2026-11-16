import Link from "next/link";
import { ActionButton, ScheduleForm } from "@/components/PublishingForms";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import type { Publication, PublishOptions, PublishingOverview, VideoList } from "@/lib/api";
import { fmt, formatDateTime } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { publicationTone, UPCOMING } from "@/lib/publishing";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const { locale, t } = await getI18n();
  const c = t.calendar;
  const [ov, vids] = await Promise.all([
    authedFetch<PublishingOverview>("/api/v1/publishing"),
    authedFetch<VideoList>("/api/v1/videos"),
  ]);
  if (!ov.ok || !vids.ok) return (<><PageHeader title={t.nav.calendar} /><Alert tone="error">{t.common.unreachable}</Alert></>);
  const st = ov.data.status;
  const approved = vids.data.videos.filter((v) => v.status === "approved");
  const opts = await Promise.all(approved.map((v) => authedFetch<PublishOptions>(`/api/v1/publishing/options/${v.id}`)));
  const options = Object.fromEntries(opts.filter((o) => o.ok).map((o) => [(o as { data: PublishOptions }).data.render_id, (o as { data: PublishOptions }).data]));
  const pubs = ov.data.publications;
  const upcoming = pubs.filter((p) => UPCOMING.includes(p.status)).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const history = pubs.filter((p) => !UPCOMING.includes(p.status));
  const dest = t.videos.platformNames as Record<string, string>;

  const row = (p: Publication) => (
    <li key={p.id} className="py-2" data-publication={p.id} data-status={p.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/calendar/${p.id}`} lang="yo" className="font-medium text-navy underline decoration-gold/60 underline-offset-2">
          {p.lesson_title ?? p.title}
        </Link>
        <div className="flex gap-1">
          {p.is_sample && <Badge tone="gold">{t.episodes.sample}</Badge>}
          <Badge tone={publicationTone(p.status)}>{c.status[p.status]}</Badge>
        </div>
      </div>
      <p className="mt-1 text-xs text-charcoal-400">
        {dest[p.destination] ?? p.destination} · {p.account.name} · {(c.visibilities as Record<string, string>)[p.visibility] ?? p.visibility} · {formatDateTime(p.published_at ?? p.scheduled_at, locale)} · {c.mode[p.approval_mode]}
      </p>
      {p.status === "retrying" && p.next_attempt_at && <p className="text-xs text-charcoal-400">{fmt(c.nextTry, { when: formatDateTime(p.next_attempt_at, locale) })}</p>}
      {p.error && <p className="text-xs text-red-800">{p.error}</p>}
    </li>
  );

  return (
    <>
      <PageHeader title={t.nav.calendar} subtitle={c.subtitle} />
      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        <div className={`rounded-lg border p-4 ${st.paused ? "border-red-300 bg-red-50" : "border-navy-100 bg-white"}`} data-testid="publishing-state">
          <p className="font-semibold text-navy">{st.paused ? c.paused : c.running}</p>
          {st.paused && st.pause_reason && <p className="mt-1 text-sm">{fmt(c.pauseReason, { reason: st.pause_reason })}</p>}
          <p className="mt-1 text-xs text-charcoal-400">{fmt(c.sentToday, { n: st.sent_today, limit: st.daily_limit })}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton action="pause" fields={st.paused ? { resume: "1" } : {}} text={st.paused ? c.resume : c.pause} primary={st.paused} />
            {!st.paused && <ActionButton action="runNow" text={c.runNow} ok={c.queued} />}
          </div>
        </div>
        <div className="rounded-lg border border-navy-100 bg-white p-4 text-sm" data-testid="trial-state">
          {st.trial_mode ? (
            <p>{fmt(c.trial, { n: st.approved_count, required: st.required_approved })}</p>
          ) : (
            <p>{c.unlocked} {st.allow_public && c.publicAllowed}</p>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={c.schedule}>
          {approved.length === 0 ? (
            <p className="text-sm text-charcoal-400">{c.noApproved}</p>
          ) : (
            <ScheduleForm
              videos={approved.map((v) => ({ id: v.id, title: `${v.title_yo || v.title_en}${v.is_sample ? ` (${t.episodes.sample})` : ""}` }))}
              options={options}
              t={{ ...c, visibilities: c.visibilities as Record<string, string>, destinations: dest }}
            />
          )}
        </Card>
        <div className="space-y-5">
          <Card title={c.upcoming}>
            {upcoming.length === 0 ? <p className="text-sm text-charcoal-400">{c.noUpcoming}</p> : <ul className="divide-y divide-navy-50 text-sm">{upcoming.map(row)}</ul>}
          </Card>
          <Card title={c.history}>
            {history.length === 0 ? <p className="text-sm text-charcoal-400">{c.noHistory}</p> : <ul className="divide-y divide-navy-50 text-sm">{history.map(row)}</ul>}
          </Card>
        </div>
      </div>
    </>
  );
}
