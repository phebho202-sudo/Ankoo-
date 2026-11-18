import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { GateReport } from "@/components/GateReport";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { DecisionForm } from "@/components/VideoForms";
import type { VideoRender } from "@/lib/api";
import { fmt, formatDateTime, formatUsdPrecise } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { authedFetch } from "@/lib/session";
import { inProgress, renderTone } from "@/lib/videos";

export const dynamic = "force-dynamic";

export default async function VideoRenderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { locale, t } = await getI18n();
  const v = t.videos;
  const res = await authedFetch<VideoRender>(`/api/v1/videos/${encodeURIComponent(id)}`);
  if (!res.ok && res.httpStatus === 404) notFound();
  if (!res.ok) return <Alert tone="error">{t.common.unreachable}</Alert>;
  const r = res.data;
  const assets = r.assets ?? [];
  const one = (k: string) => assets.find((a) => a.kind === k);
  const link = "text-sm text-navy underline decoration-gold underline-offset-4";
  const names = v.checks as Record<string, string>;
  const done = !inProgress(r.status) && r.status !== "failed" && r.status !== "blocked";
  const longVideo = one("video_long");
  const vertical = one("video_vertical");

  return (
    <>
      {inProgress(r.status) && <AutoRefresh />}
      <Link href="/video" className={`mb-3 inline-block ${link}`}>← {v.back}</Link>
      <PageHeader
        title={r.title_yo || r.title_en || t.nav.video}
        subtitle={`${t.scripts.colRevision} ${r.script_revision} · ${formatDateTime(r.created_at, locale)}`}
        badge={
          <div className="flex gap-2">
            {r.is_sample && <Badge tone="gold">{t.episodes.sample}</Badge>}
            <Badge tone={renderTone(r.status)}>{v.status[r.status]}</Badge>
          </div>
        }
      />
      <div className="mb-5 space-y-3">
        {r.error && <Alert tone="error">{r.error}</Alert>}
        {r.is_sample && done && <Alert tone="warn">{v.sampleNote}</Alert>}
        {r.decided_by && r.decided_at && (
          <p className="text-sm text-charcoal-600">
            {fmt(v.decided, { who: r.decided_by, when: formatDateTime(r.decided_at, locale) })}
            {r.decision_notes && <span lang="yo"> — {r.decision_notes}</span>}
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {longVideo && (
            <Card title={v.long}>
              <video controls preload="metadata" src={`/media/${longVideo.id}`} poster={one("thumbnail_long") ? `/media/${one("thumbnail_long")!.id}` : undefined} className="w-full rounded-md bg-navy" data-testid="video-long" />
            </Card>
          )}
          {vertical && (
            <Card title={v.vertical}>
              <p className="-mt-2 mb-3 text-xs text-charcoal-400">{r.vertical_is_full ? v.verticalWhole : v.verticalTeaser}</p>
              <video controls preload="metadata" src={`/media/${vertical.id}`} poster={one("thumbnail_vertical") ? `/media/${one("thumbnail_vertical")!.id}` : undefined} className="mx-auto max-h-[640px] rounded-md bg-navy" data-testid="video-vertical" />
            </Card>
          )}
          {r.status === "awaiting_approval" && (
            <Card title={v.review}>
              <p className="-mt-2 mb-3 text-xs text-charcoal-400">{v.reviewHelp}</p>
              <DecisionForm t={v} id={r.id} items={r.checklist_items ?? []} />
            </Card>
          )}
        </div>
        <div className="space-y-5">
          {r.cost && (
            <Card title={v.cost}>
              <dl className="grid grid-cols-2 gap-2 text-sm" data-testid="video-cost">
                <dt className="text-charcoal-400">{v.costScript}</dt><dd className="tabular-nums">{formatUsdPrecise(r.cost.script_usd, locale)}</dd>
                <dt className="text-charcoal-400">{v.costVoice}</dt><dd className="tabular-nums">{formatUsdPrecise(r.cost.voice_usd, locale)}</dd>
                <dt className="text-charcoal-400">{v.costRender}</dt><dd className="tabular-nums">{formatUsdPrecise(r.cost.render_usd, locale)}</dd>
                <dt className="font-semibold">{v.costTotal}</dt><dd className="font-semibold tabular-nums">{formatUsdPrecise(r.cost.total_usd, locale)}</dd>
              </dl>
            </Card>
          )}
          {Object.keys(r.platforms).length > 0 && (
            <Card title={v.platforms}>
              <ul className="space-y-1 text-sm">
                {Object.entries(r.platforms).map(([k, ok]) => (
                  <li key={k} className="flex justify-between gap-2" data-platform={k} data-fits={ok}>
                    <span>{(v.platformNames as Record<string, string>)[k] ?? k}</span>
                    <Badge tone={ok ? "green" : "neutral"}>{ok ? v.fits : v.doesNotFit}</Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-charcoal-400">{v.platformNote}</p>
            </Card>
          )}
          {(one("thumbnail_long") || one("thumbnail_vertical")) && (
            <Card title={v.thumbnails}>
              <div className="flex items-start gap-3">
                {["thumbnail_long", "thumbnail_vertical"].map((k) => one(k) && (
                  <a key={k} href={`/media/${one(k)!.id}`} target="_blank" rel="noopener" className={k === "thumbnail_long" ? "w-2/3" : "w-1/3"}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/media/${one(k)!.id}`} alt={v.thumbnails} loading="lazy" className="w-full rounded border border-navy-100" />
                  </a>
                ))}
              </div>
            </Card>
          )}
          {assets.some((a) => a.kind.startsWith("captions_")) && (
            <Card title={v.captions}>
              <ul className="space-y-2">
                {Object.entries(v.captionFiles).map(([k, label]) => one(k) && (
                  <li key={k}><a className={link} href={`/media/${one(k)!.id}`}>{label}</a></li>
                ))}
              </ul>
            </Card>
          )}
          {r.value_report && (
            <Card title={v.gate}>
              <GateReport checks={r.value_report.checks} names={names} advisory={v.advisory} notEnforced={v.notEnforced} />
            </Card>
          )}
          {(r.checks?.length ?? 0) > 0 && (
            <Card title={v.autoChecks}>
              <GateReport checks={r.checks!} names={names} advisory={v.advisory} notEnforced={v.notEnforced} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
