import Link from "next/link";
import { notFound } from "next/navigation";
import { ResearchRequestForm, TranscriptForm } from "@/components/ResearchForms";
import { RightsCheckForm } from "@/components/RightsForms";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import type { EpisodeDetail, RightsCheckRow } from "@/lib/api";
import { describeReason } from "@/lib/rights";
import { fmt, formatDate, formatDateTime, formatDuration, formatUsdPrecise } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { locale, t } = await getI18n();
  const e = t.episodes;
  const [r, checks] = await Promise.all([
    authedFetch<EpisodeDetail>(`/api/v1/episodes/${encodeURIComponent(id)}`),
    authedFetch<{ checks: RightsCheckRow[] }>(`/api/v1/rights/checks?episode_id=${encodeURIComponent(id)}&limit=1`),
  ]);
  const last = checks.ok ? checks.data.checks[0] : undefined;
  if (!r.ok && r.httpStatus === 404) notFound();
  if (!r.ok) return <Alert tone="error">{t.common.unreachable}</Alert>;
  const ep = r.data;

  return (
    <>
      <Link href="/episodes" className="mb-3 inline-block text-sm text-navy underline decoration-gold underline-offset-4">
        ← {e.back}
      </Link>
      <PageHeader
        title={ep.title}
        subtitle={`${ep.channel_title} · ${formatDate(ep.published_at, locale)} · ${formatDuration(ep.duration_seconds)}`}
        badge={
          <div className="flex flex-wrap gap-2">
            {ep.is_sample && <Badge tone="gold">{e.sample}</Badge>}
            {ep.possible_duplicate_of_id && (
              <Link href={`/episodes/${ep.possible_duplicate_of_id}`}>
                <Badge tone="red">{e.possibleDuplicate}</Badge>
              </Link>
            )}
            <Badge tone={ep.status === "researched" ? "green" : "neutral"}>{e.status[ep.status]}</Badge>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title={e.description}>
            <p className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
              {ep.description || e.noDescription}
            </p>
            {!ep.is_sample && (
              <a href={ep.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-medium text-navy underline decoration-gold underline-offset-4">
                {e.open} ↗
              </a>
            )}
            {ep.has_captions && <p className="mt-2 text-xs text-charcoal-400">{e.captions}</p>}
          </Card>

          <Card title={e.transcript}>
            <p className="mb-4 text-xs text-charcoal-400">{e.transcriptRule}</p>
            {ep.transcript ? (
              <div className="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <p>
                  {fmt(e.transcriptHeld, {
                    words: ep.transcript.word_count.toLocaleString(),
                    source: e.sources[ep.transcript.source],
                    who: ep.transcript.added_by,
                  })}
                </p>
                <p className="mt-1 text-xs">
                  {e.permission}: “{ep.transcript.permission_reference}”
                </p>
              </div>
            ) : (
              <p className="mb-4 text-sm">{e.transcriptNone}</p>
            )}
            <details open={!ep.transcript}>
              <summary className="cursor-pointer text-sm font-semibold text-navy">{e.saveTranscript}</summary>
              <div className="mt-3">
                <TranscriptForm episodeId={ep.id} labels={{ ...e, english: t.common.english, yoruba: t.common.yoruba }} />
              </div>
            </details>
          </Card>
        </div>

        <div className="space-y-5">
        <Card title={t.nav.rights}>
          {last ? (
            <div className={`mb-3 rounded-md border px-3 py-2 text-xs ${last.allowed ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-900"}`}>
              <p className="font-semibold">
                {last.allowed ? "✓" : "✕"} {t.rights.purposes[last.purpose]}
                {last.platform ? ` · ${(t.rights.platformNames as Record<string, string>)[last.platform] ?? last.platform}` : ""}
              </p>
              {!last.allowed && (
                <ul className="mt-1 list-disc pl-4">
                  {last.reasons.map((x, i) => (
                    <li key={i}>{describeReason(x, t.rights)}</li>
                  ))}
                </ul>
              )}
              <p className="mt-1 opacity-75">{fmt(t.rights.lastCheck, { when: formatDateTime(last.checked_at, locale) })}</p>
            </div>
          ) : (
            <p className="mb-3 text-sm text-charcoal-400">{t.rights.noChecks}</p>
          )}
          <RightsCheckForm t={t.rights} episodeId={ep.id} />
        </Card>
        <Card title={e.research}>
          <p className="mb-3 text-sm text-charcoal-400">{e.researchHelp}</p>
          <ResearchRequestForm episodeId={ep.id} labels={{ start: e.runResearch }} jobLabels={t.jobs} />
          <ul className="mt-5 divide-y divide-navy-50 text-sm">
            {ep.reports.length === 0 && <li className="py-2 text-charcoal-400">{e.noReports}</li>}
            {ep.reports.map((rep) => (
              <li key={rep.id} className="py-2">
                <Link href={`/research/${rep.id}`} className="font-medium text-navy underline decoration-gold/60 underline-offset-2">
                  {formatDateTime(rep.created_at, locale)}
                </Link>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone={rep.status === "completed" ? "green" : rep.status === "pending" ? "neutral" : "red"}>
                    {t.research.reportStatus[rep.status]}
                  </Badge>
                  {rep.overlap_flagged && <Badge tone="red">!</Badge>}
                  <span className="text-xs text-charcoal-400">{formatUsdPrecise(rep.cost_usd, locale)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        </div>
      </div>
    </>
  );
}
