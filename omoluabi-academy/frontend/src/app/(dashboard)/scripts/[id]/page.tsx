import Link from "next/link";
import { notFound } from "next/navigation";
import { GenerationWatcher, ReviewForm, ReviseForm, ScriptEditor, SubmitForm } from "@/components/ScriptForms";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import type { ScriptDetail } from "@/lib/api";
import { fmt, formatDateTime } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { describeIssue, minutesSeconds, statusTone } from "@/lib/scripts";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ScriptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string }>;
}) {
  const { id } = await params;
  const { revision } = await searchParams;
  const { locale, t } = await getI18n();
  const st = t.scripts;
  const rev = revision && /^\d+$/.test(revision) ? revision : undefined;
  const res = await authedFetch<ScriptDetail>(`/api/v1/scripts/${encodeURIComponent(id)}${rev ? `?revision=${rev}` : ""}`);
  if (!res.ok && res.httpStatus === 404) notFound();
  if (!res.ok) return <Alert tone="error">{t.common.unreachable}</Alert>;
  const s = res.data;
  const r = s.revision;
  const isLatest = !r || r.number === s.current_revision;
  const editable = isLatest && ["draft", "changes_requested", "approved"].includes(s.status);
  const dl = (type: string) => `/scripts/${s.id}/download?type=${type}${r ? `&revision=${r.number}` : ""}`;
  const { min, sec } = minutesSeconds(r?.estimated_seconds ?? 0);

  return (
    <>
      {s.status === "generating" && <GenerationWatcher id={s.id} revision={s.current_revision} />}
      <Link href="/scripts" className="mb-3 inline-block text-sm text-navy underline decoration-gold underline-offset-4">
        ← {st.back}
      </Link>
      <PageHeader
        title={s.title_yo || s.title_en}
        subtitle={`${s.title_en} · ${st.kinds[s.kind]} · ${st.formats[s.format]}`}
        badge={
          <div className="flex flex-wrap gap-2">
            {s.is_sample && <Badge tone="gold">{t.episodes.sample}</Badge>}
            <Badge tone={statusTone(s.status)}>{st.status[s.status]}</Badge>
            {r && <Badge>{fmt(st.revisionOf, { n: r.number, total: s.current_revision })}</Badge>}
          </div>
        }
      />
      <div className="mb-5 space-y-3">
        {s.status === "generating" && <Alert tone="warn">{st.generating}</Alert>}
        {s.blocked_reason && <Alert tone="error">{fmt(st.blocked, { reason: s.blocked_reason })}</Alert>}
        {r?.is_sample && <Alert tone="warn">{st.sampleNote}</Alert>}
        {!isLatest && (
          <Alert tone="warn">
            {fmt(st.viewingOld, { n: r?.number ?? 0 })}{" "}
            <Link href={`/scripts/${s.id}`} className="font-semibold underline">{st.latest}</Link>
          </Alert>
        )}
        {s.status === "approved" && s.approved_revision && (
          <Alert tone="ok">
            {fmt(st.approvedBy, {
              n: s.approved_revision,
              who: s.reviews.find((v) => v.decision === "approved")?.reviewer ?? "",
              when: s.approved_at ? formatDateTime(s.approved_at, locale) : "",
            })}{" "}
            {st.readyForVoice}
          </Alert>
        )}
      </div>

      {r && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card title={st.segments}>
              <ScriptEditor key={`${r.number}`} t={st} id={s.id} titleYo={r.title_yo} segments={r.segments} canEdit={editable}>
                <p className="mb-3 text-xs text-charcoal-400">{fmt(st.estimated, { min, sec })}</p>
                <ol className="space-y-3">
                  {r.segments.map((seg, i) => (
                    <li key={seg.id} className={`grid gap-2 rounded-md border p-3 md:grid-cols-2 ${seg.locked ? "border-navy-100 bg-navy-50" : "border-navy-50 bg-white"}`}>
                      <div>
                        <span className="mr-2 text-xs font-semibold text-navy-700">{seg.locked ? "🔒" : i + 1}</span>
                        <span lang="yo" className="text-[15px] leading-relaxed">{seg.text_yo}</span>
                      </div>
                      <div className="text-sm text-charcoal">
                        {seg.text_en}
                        {seg.visual && <div className="mt-1 text-xs text-charcoal-400">▸ {seg.visual}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
              </ScriptEditor>
            </Card>
            <Card title={st.revisions}>
              <ul className="divide-y divide-navy-50 text-sm">
                {s.revisions.map((v) => (
                  <li key={v.number} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                    <Link href={`/scripts/${s.id}?revision=${v.number}`} className="font-medium text-navy underline decoration-gold/60 underline-offset-2">
                      {st.colRevision} {v.number}
                    </Link>
                    <span className="text-xs text-charcoal-400">
                      {st.origins[v.origin]} · {v.created_by} · {formatDateTime(v.created_at, locale)} · {st.score} {v.score}
                    </span>
                    {v.change_note && <p className="w-full text-xs">{v.change_note}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="space-y-5">
            <Card title={st.quality}>
              <p className="text-3xl font-semibold tabular-nums text-navy">{r.quality.score}<span className="text-base text-charcoal-400">/100</span></p>
              {r.quality.errors.length === 0 && r.quality.warnings.length === 0 && <p className="mt-2 text-sm text-emerald-800">✓ {st.noIssues}</p>}
              {r.quality.errors.length > 0 && (
                <div className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
                  <p className="font-semibold">{st.errorsTitle}</p>
                  <ul className="mt-1 list-disc pl-5">{r.quality.errors.map((e, i) => <li key={i}>{describeIssue(e, st)}</li>)}</ul>
                </div>
              )}
              {r.quality.warnings.length > 0 && (
                <div className="mt-3 rounded-md border border-gold-300 bg-gold-100/50 px-3 py-2 text-sm">
                  <p className="font-semibold">{st.warningsTitle}</p>
                  <ul className="mt-1 list-disc pl-5">{r.quality.warnings.map((e, i) => <li key={i}>{describeIssue(e, st)}</li>)}</ul>
                </div>
              )}
              {r.originality && <p className="mt-3 text-xs">{fmt(st.originality, { words: r.originality.words })}</p>}
              <p className="mt-3 text-xs text-charcoal-400">{st.disclaimer}</p>
            </Card>

            {isLatest && ["draft", "changes_requested"].includes(s.status) && (
              <Card title={st.actions}>
                <SubmitForm t={st} id={s.id} />
              </Card>
            )}
            {isLatest && s.status === "in_review" && (
              <Card title={st.review}>
                <ReviewForm t={st} id={s.id} items={s.checklist_items} />
              </Card>
            )}
            {isLatest && ["draft", "changes_requested", "approved"].includes(s.status) && (
              <Card title={st.reviseTitle}>
                <ReviseForm t={st} id={s.id} jobLabels={t.jobs} />
              </Card>
            )}

            <Card title={st.exports}>
              <ul className="space-y-2 text-sm">
                <li><a href={dl("srt-yo")} className="text-navy underline decoration-gold underline-offset-4">{st.srtYo}</a></li>
                <li><a href={dl("srt-en")} className="text-navy underline decoration-gold underline-offset-4">{st.srtEn}</a></li>
                <li><a href={dl("text")} className="text-navy underline decoration-gold underline-offset-4">{st.textFile}</a></li>
              </ul>
              <p className="mt-3 text-xs text-charcoal-400">{st.srtNote}</p>
            </Card>

            <Card title={st.reviews}>
              {s.reviews.length === 0 ? (
                <p className="text-sm text-charcoal-400">{st.noReviews}</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {s.reviews.map((v, i) => (
                    <li key={i}>
                      <Badge tone={v.decision === "approved" ? "green" : "gold"}>{st.decisions[v.decision]}</Badge>{" "}
                      <span className="text-xs text-charcoal-400">
                        {st.colRevision} {v.revision_number} · {v.reviewer} · {formatDateTime(v.created_at, locale)}
                      </span>
                      {v.comments && <p className="mt-1" lang="yo">“{v.comments}”</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
