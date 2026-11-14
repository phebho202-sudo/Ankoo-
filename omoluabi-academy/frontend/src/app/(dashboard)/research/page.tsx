import Link from "next/link";
import { ResearchRequestForm } from "@/components/ResearchForms";
import { TopicCard } from "@/components/TopicCard";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import type { ReportSummary, TopicItem } from "@/lib/api";
import { fmt, formatDateTime, formatUsdPrecise } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const { locale, t } = await getI18n();
  const r = t.research;
  const [proposed, approved, reports] = await Promise.all([
    authedFetch<{ topics: TopicItem[] }>("/api/v1/topics?status=proposed&limit=100"),
    authedFetch<{ topics: TopicItem[] }>("/api/v1/topics?status=approved&limit=100"),
    authedFetch<{ reports: ReportSummary[] }>("/api/v1/research/reports?limit=50"),
  ]);
  if (!proposed.ok || !approved.ok || !reports.ok) {
    return (
      <>
        <PageHeader title={t.nav.research} />
        <Alert tone="error">{t.common.unreachable}</Alert>
      </>
    );
  }
  const subjectOf = Object.fromEntries(reports.data.reports.map((x) => [x.id, x.subject]));
  const fromReport = (topic: TopicItem) => (
    <p className="mt-3 text-xs">
      <Link href={`/research/${topic.report_id}`} className="text-navy underline decoration-gold/60 underline-offset-2">
        {fmt(r.fromReport, { subject: subjectOf[topic.report_id] ?? "…" })}
      </Link>
    </p>
  );

  return (
    <>
      <PageHeader title={t.nav.research} subtitle={r.subtitle} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title={`${r.queue} (${proposed.data.topics.length})`}>
            {proposed.data.topics.length === 0 ? (
              <p className="text-sm text-charcoal-400">{r.queueEmpty}</p>
            ) : (
              <div className="space-y-3">
                {proposed.data.topics.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} t={t} canDecide footer={fromReport(topic)} />
                ))}
              </div>
            )}
          </Card>
          <Card title={`${r.approvedTitle} (${approved.data.topics.length})`}>
            {approved.data.topics.length === 0 ? (
              <p className="text-sm text-charcoal-400">{r.approvedEmpty}</p>
            ) : (
              <div className="space-y-3">
                {approved.data.topics.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} t={t} canDecide={false} footer={fromReport(topic)} />
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title={r.newSubject}>
            <ResearchRequestForm labels={r} jobLabels={t.jobs} />
          </Card>
          <Card title={r.reports}>
            {reports.data.reports.length === 0 ? (
              <p className="text-sm text-charcoal-400">{r.reportsEmpty}</p>
            ) : (
              <ul className="divide-y divide-navy-50 text-sm">
                {reports.data.reports.map((rep) => (
                  <li key={rep.id} className="py-2">
                    <Link href={`/research/${rep.id}`} className="font-medium text-navy underline decoration-gold/60 underline-offset-2">
                      {rep.subject}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-charcoal-400">
                      <Badge tone={rep.status === "completed" ? "green" : rep.status === "pending" ? "neutral" : "red"}>
                        {r.reportStatus[rep.status]}
                      </Badge>
                      {rep.is_sample && <Badge tone="gold">{t.episodes.sample}</Badge>}
                      {rep.overlap_flagged && <Badge tone="red">!</Badge>}
                      <span>{formatDateTime(rep.created_at, locale)}</span>
                      <span>· {formatUsdPrecise(rep.cost_usd, locale)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
