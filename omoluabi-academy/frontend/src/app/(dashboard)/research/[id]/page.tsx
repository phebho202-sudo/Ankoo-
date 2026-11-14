import Link from "next/link";
import { notFound } from "next/navigation";
import { TopicCard } from "@/components/TopicCard";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import type { ReportDetail } from "@/lib/api";
import { fmt, formatDateTime, formatUsdPrecise } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { locale, t } = await getI18n();
  const r = t.research;
  const res = await authedFetch<ReportDetail>(`/api/v1/research/reports/${encodeURIComponent(id)}`);
  if (!res.ok && res.httpStatus === 404) notFound();
  if (!res.ok) return <Alert tone="error">{t.common.unreachable}</Alert>;
  const rep = res.data;
  const tone = rep.status === "completed" ? "green" : rep.status === "pending" ? "neutral" : "red";

  return (
    <>
      <Link href="/research" className="mb-3 inline-block text-sm text-navy underline decoration-gold underline-offset-4">
        ← {r.back}
      </Link>
      <PageHeader
        title={rep.subject}
        subtitle={formatDateTime(rep.created_at, locale)}
        badge={
          <div className="flex gap-2">
            {rep.is_sample && <Badge tone="gold">{t.episodes.sample}</Badge>}
            <Badge tone={tone}>{r.reportStatus[rep.status]}</Badge>
          </div>
        }
      />
      {rep.is_sample && (
        <div className="mb-5">
          <Alert tone="warn">{r.sampleNote}</Alert>
        </div>
      )}
      {rep.error && (
        <div className="mb-5">
          <Alert tone="error">
            <strong>{r.problem}:</strong> {rep.error}
          </Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {rep.summary && (
            <Card title={r.summary}>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{rep.summary}</p>
              <p className="mt-3 text-xs text-charcoal-400">{rep.used_transcript ? r.withTranscript : r.noTranscript}</p>
            </Card>
          )}
          {rep.topics.length > 0 && (
            <Card title={r.topics}>
              <div className="space-y-3">
                {rep.topics.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} t={t} canDecide={!rep.overlap_flagged} />
                ))}
              </div>
            </Card>
          )}
          {rep.key_concepts.length > 0 && (
            <Card title={r.concepts}>
              <dl className="space-y-3 text-sm">
                {rep.key_concepts.map((c) => (
                  <div key={c.name}>
                    <dt className="font-semibold text-navy">{c.name}</dt>
                    <dd className="leading-relaxed">{c.explanation}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
          {rep.nigerian_context && (
            <Card title={r.nigeria}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{rep.nigerian_context}</p>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {rep.status === "completed" && (
            <Card>
              {rep.overlap_flagged ? (
                <Alert tone="error">{fmt(r.overlapBad, { n: rep.max_verbatim_overlap_words })}</Alert>
              ) : (
                <Alert tone="ok">{fmt(r.overlapOk, { n: rep.max_verbatim_overlap_words })}</Alert>
              )}
            </Card>
          )}
          <Card>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-charcoal-400">{r.cost}</dt>
                <dd className="font-semibold tabular-nums">{formatUsdPrecise(rep.cost_usd, locale)}</dd>
              </div>
              <div>
                <dt className="text-xs text-charcoal-400">{r.model}</dt>
                <dd className="truncate font-medium">{rep.model ?? "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-charcoal-400">{r.tokens}</dt>
                <dd className="tabular-nums">
                  {rep.input_tokens.toLocaleString()} → {rep.output_tokens.toLocaleString()}
                </dd>
              </div>
            </dl>
            {rep.episode_id && (
              <Link href={`/episodes/${rep.episode_id}`} className="mt-4 inline-block text-sm text-navy underline decoration-gold underline-offset-4">
                {t.nav.episodes} →
              </Link>
            )}
          </Card>
          {rep.cautions.length > 0 && (
            <Card title={r.cautions}>
              <ul className="list-disc space-y-2 pl-5 text-sm">
                {rep.cautions.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
