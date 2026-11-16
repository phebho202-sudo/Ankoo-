import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import type { ProductionRun } from "@/lib/api";
import { fmt, formatDateTime, formatUsdPrecise } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { minutesSeconds } from "@/lib/scripts";
import { authedFetch } from "@/lib/session";
import { RunWatcher } from "./RunWatcher";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { locale, t } = await getI18n();
  const v = t.voice;
  const res = await authedFetch<ProductionRun>(`/api/v1/voice/runs/${encodeURIComponent(id)}`);
  if (!res.ok && res.httpStatus === 404) notFound();
  if (!res.ok) return <Alert tone="error">{t.common.unreachable}</Alert>;
  const r = res.data;
  const assets = r.assets ?? [];
  const one = (k: string) => assets.find((a) => a.kind === k);
  const segs = assets.filter((a) => a.kind === "segment_audio");
  const slides = assets.filter((a) => a.kind === "slide");
  const { min, sec } = minutesSeconds(r.duration_seconds);
  const link = "text-sm text-navy underline decoration-gold underline-offset-4";

  return (
    <>
      {(r.status === "queued" || r.status === "running") && <RunWatcher />}
      <Link href="/voice" className="mb-3 inline-block text-sm text-navy underline decoration-gold underline-offset-4">← {v.back}</Link>
      <PageHeader
        title={`${t.nav.voice} · ${t.scripts.colRevision} ${r.script_revision}`}
        subtitle={`${formatDateTime(r.created_at, locale)} · ${r.video_format}`}
        badge={
          <div className="flex gap-2">
            {r.is_sample && <Badge tone="gold">{t.episodes.sample}</Badge>}
            <Badge tone={r.status === "completed" ? "green" : r.status === "failed" || r.status === "blocked" ? "red" : "neutral"}>{v.runStatus[r.status]}</Badge>
          </div>
        }
      />
      <div className="mb-5 space-y-3">
        {r.error && <Alert tone="error">{r.error}</Alert>}
        {r.is_sample && r.status === "completed" && <Alert tone="warn">{v.sampleNote}</Alert>}
        <Link href={`/scripts/${r.script_id}`} className={link}>{t.nav.scripts} →</Link>
      </div>
      {r.status === "completed" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card title={v.presenterClip}>
              {one("presenter_clip") && <video controls preload="metadata" src={`/media/${one("presenter_clip")!.id}`} className="w-full rounded-md bg-navy" />}
            </Card>
            <Card title={v.narration}>
              {one("narration") && <audio controls preload="metadata" src={`/media/${one("narration")!.id}`} className="w-full" />}
              {one("waveform") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/media/${one("waveform")!.id}`} alt={v.waveform} className="mt-3 w-full rounded-md bg-navy p-2" />
              )}
            </Card>
            <Card title={v.slides}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {slides.map((s) => (
                  <a key={s.id} href={`/media/${s.id}`} target="_blank" rel="noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/media/${s.id}`} alt={`${v.slides} ${s.position}`} loading="lazy" className="w-full rounded border border-navy-100" />
                  </a>
                ))}
              </div>
            </Card>
          </div>
          <div className="space-y-5">
            <Card title={v.costBreakdown}>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-charcoal-400">{v.length}</dt><dd className="tabular-nums">{min}:{String(sec).padStart(2, "0")}</dd>
                <dt className="text-charcoal-400">{v.tts}</dt><dd className="tabular-nums">{formatUsdPrecise(r.tts_cost_usd, locale)} <span className="text-xs text-charcoal-400">({fmt(v.characters, { n: r.tts_characters.toLocaleString() })})</span></dd>
                <dt className="text-charcoal-400">{v.avatar}</dt><dd className="tabular-nums">{formatUsdPrecise(r.avatar_cost_usd, locale)}</dd>
                <dt className="font-semibold">{v.total}</dt><dd className="font-semibold tabular-nums">{formatUsdPrecise(r.total_cost_usd, locale)}</dd>
              </dl>
              {r.tts_provider && <p className="mt-2 text-xs text-charcoal-400">{r.tts_provider}</p>}
            </Card>
            <Card title={v.captions}>
              <ul className="space-y-2">
                {one("captions_yo") && <li><a className={link} href={`/media/${one("captions_yo")!.id}`}>{v.captionsYo}</a></li>}
                {one("captions_en") && <li><a className={link} href={`/media/${one("captions_en")!.id}`}>{v.captionsEn}</a></li>}
              </ul>
            </Card>
            <Card title={v.segments}>
              <ol className="space-y-2 text-xs">
                {segs.map((s) => (
                  <li key={s.id}>
                    <span className="tabular-nums text-charcoal-400">{s.position}. {s.duration_seconds?.toFixed(1)} s</span>
                    <audio controls preload="none" src={`/media/${s.id}`} className="mt-1 h-8 w-full" />
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
