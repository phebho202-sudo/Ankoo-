import Link from "next/link";
import { GateReport } from "@/components/GateReport";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { RenderForm } from "@/components/VideoForms";
import type { RenderCandidate, VideoList } from "@/lib/api";
import { fmt, formatDateTime } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { minutesSeconds } from "@/lib/scripts";
import { authedFetch } from "@/lib/session";
import { renderTone } from "@/lib/videos";

export const dynamic = "force-dynamic";

function clock(seconds: number | null) {
  if (seconds == null) return "–";
  const { min, sec } = minutesSeconds(seconds);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export default async function VideoPage() {
  const { locale, t } = await getI18n();
  const v = t.videos;
  const [list, cands] = await Promise.all([
    authedFetch<VideoList>("/api/v1/videos"),
    authedFetch<{ candidates: RenderCandidate[] }>("/api/v1/videos/candidates"),
  ]);
  if (!list.ok || !cands.ok) {
    return (<><PageHeader title={t.nav.video} /><Alert tone="error">{t.common.unreachable}</Alert></>);
  }
  const { videos, approved_count, required_approved } = list.data;
  const names = v.checks as Record<string, string>;
  const pct = Math.min(100, Math.round((approved_count / Math.max(1, required_approved)) * 100));

  return (
    <>
      <PageHeader title={t.nav.video} subtitle={v.subtitle} />
      <div className="mb-6 rounded-lg border border-navy-100 bg-white p-4" data-testid="unlock">
        <p className="text-sm font-medium text-navy">{fmt(v.unlock, { n: approved_count, required: required_approved })}</p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded bg-navy-50" role="progressbar" aria-valuenow={approved_count} aria-valuemin={0} aria-valuemax={required_approved}>
          <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-charcoal-400">{v.sampleUnlock}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={v.ready}>
          <p className="-mt-2 mb-3 text-xs text-charcoal-400">{v.readyHelp}</p>
          {cands.data.candidates.length === 0 && <p className="text-sm text-charcoal-400">{v.noReady}</p>}
          <ul className="space-y-4">
            {cands.data.candidates.map((c) => (
              <li key={c.run.id} className="rounded-md border border-navy-50 p-3" data-candidate={c.run.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/voice/runs/${c.run.id}`} lang="yo" className="font-medium text-navy underline decoration-gold/60 underline-offset-2">
                    {c.title_yo || c.title_en}
                  </Link>
                  <div className="flex gap-1">
                    {c.run.is_sample && <Badge tone="gold">{t.episodes.sample}</Badge>}
                    <Badge tone={c.value_report.passed ? "green" : "red"}>{c.value_report.passed ? v.gatePassed : v.gateFailed}</Badge>
                  </div>
                </div>
                <p className="mt-1 text-xs text-charcoal-400">{clock(c.run.duration_seconds)} · {c.format === "short" ? v.vertical : `${v.long} + ${v.vertical}`}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-navy">{v.gate}</summary>
                  <div className="mt-2"><GateReport checks={c.value_report.checks} names={names} advisory={v.advisory} notEnforced={v.notEnforced} /></div>
                </details>
                <div className="mt-3"><RenderForm t={v} runId={c.run.id} disabled={!c.value_report.passed} /></div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={v.list}>
          {videos.length === 0 && <p className="text-sm text-charcoal-400">{v.noVideos}</p>}
          <ul className="divide-y divide-navy-50 text-sm">
            {videos.map((r) => {
              const fits = Object.entries(r.platforms).filter(([, ok]) => ok).map(([k]) => (v.platformNames as Record<string, string>)[k] ?? k);
              return (
                <li key={r.id} className="py-2" data-video={r.id}>
                  <Link href={`/video/${r.id}`} lang="yo" className="font-medium text-navy underline decoration-gold/60 underline-offset-2">
                    {r.title_yo || r.title_en} · {t.scripts.colRevision} {r.script_revision}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-charcoal-400">
                    <Badge tone={renderTone(r.status)}>{v.status[r.status]}</Badge>
                    {r.is_sample && <Badge tone="gold">{t.episodes.sample}</Badge>}
                    <span>{clock(r.long_seconds)} / {clock(r.vertical_seconds)} · {formatDateTime(r.created_at, locale)}</span>
                  </div>
                  {fits.length > 0 && <p className="mt-1 text-xs text-charcoal-400">{v.colPlatforms}: {fits.join(", ")}</p>}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
