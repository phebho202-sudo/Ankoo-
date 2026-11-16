import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, ResolveForm } from "@/components/PublishingForms";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import type { Publication } from "@/lib/api";
import { fmt, formatDateTime } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { publicationTone } from "@/lib/publishing";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PublicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { locale, t } = await getI18n();
  const c = t.calendar;
  const res = await authedFetch<Publication>(`/api/v1/publications/${encodeURIComponent(id)}`);
  if (!res.ok && res.httpStatus === 404) notFound();
  if (!res.ok) return <Alert tone="error">{t.common.unreachable}</Alert>;
  const p = res.data;
  const link = "text-sm text-navy underline decoration-gold underline-offset-4";
  const dest = t.videos.platformNames as Record<string, string>;
  const outcomes = c.outcomes as Record<string, string>;
  const warnings = c.warnings as Record<string, string>;

  return (
    <>
      <Link href="/calendar" className={`mb-3 inline-block ${link}`}>← {c.back}</Link>
      <PageHeader
        title={p.title}
        subtitle={`${dest[p.destination] ?? p.destination} · ${p.account.name} · ${formatDateTime(p.scheduled_at, locale)}`}
        badge={
          <div className="flex gap-2">
            {p.is_sample && <Badge tone="gold">{t.episodes.sample}</Badge>}
            <Badge tone={publicationTone(p.status)}>{c.status[p.status]}</Badge>
          </div>
        }
      />
      <div className="mb-5 space-y-3">
        {p.error && <Alert tone="error">{p.error}</Alert>}
        {p.warnings.map((w) => <Alert key={w} tone="warn">{warnings[w] ?? w}</Alert>)}
        {p.external_url && <a href={p.external_url} target="_blank" rel="noopener noreferrer" className={link}>{c.open} →</a>}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title={c.description}>
            <pre lang="yo" className="whitespace-pre-wrap break-words font-sans text-sm">{p.description}</pre>
          </Card>
          <Card title={c.log}>
            <ol className="space-y-2 text-sm" data-testid="log">
              {(p.log ?? []).map((a) => (
                <li key={a.number} className="rounded-md border border-navy-50 p-2" data-outcome={a.outcome}>
                  <p className="font-medium">{fmt(c.attempt, { n: a.number })} · {outcomes[a.outcome] ?? a.outcome}</p>
                  <p className="text-xs text-charcoal-400">{formatDateTime(a.started_at, locale)}{a.http_status ? ` · HTTP ${a.http_status}` : ""}</p>
                  {a.message && <p className="text-xs">{a.message}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="space-y-5">
          {(p.status === "scheduled" || p.status === "retrying") && (
            <Card title={c.cancel}><ActionButton action="cancel" fields={{ id: p.id }} text={c.cancel} /></Card>
          )}
          {p.status === "unconfirmed" && (
            <Card title={c.status.unconfirmed}>
              <p className="-mt-2 mb-3 text-xs text-charcoal-400">{c.unconfirmedHelp}</p>
              <ResolveForm id={p.id} t={c} />
            </Card>
          )}
          <Card title={c.visibility}>
            <p className="text-sm">{(c.visibilities as Record<string, string>)[p.visibility] ?? p.visibility} · {c.mode[p.approval_mode]}</p>
            {p.video_sha256 && <p className="mt-2 break-all font-mono text-xs text-charcoal-400">sha256 {p.video_sha256}</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
