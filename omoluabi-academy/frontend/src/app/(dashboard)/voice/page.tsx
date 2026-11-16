import Link from "next/link";
import { ApproveForm, PortraitForm, PresenterForm, ProduceForm, RateTestForm, RequestTestForm } from "@/components/VoiceForms";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import type { Presenter, ProductionRun, ScriptSummary, User, VoiceTest } from "@/lib/api";
import { fmt, formatDateTime, formatUsdPrecise } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { minutesSeconds } from "@/lib/scripts";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function VoicePage() {
  const { locale, t } = await getI18n();
  const v = t.voice;
  const [me, pres, tests, runs, approved] = await Promise.all([
    authedFetch<User>("/api/v1/auth/me"),
    authedFetch<{ presenter: Presenter | null }>("/api/v1/voice/presenter"),
    authedFetch<{ tests: VoiceTest[] }>("/api/v1/voice/tests"),
    authedFetch<{ runs: ProductionRun[] }>("/api/v1/voice/runs"),
    authedFetch<{ scripts: ScriptSummary[] }>("/api/v1/scripts?status=approved"),
  ]);
  if (!pres.ok || !tests.ok || !runs.ok || !approved.ok) {
    return (<><PageHeader title={t.nav.voice} /><Alert tone="error">{t.common.unreachable}</Alert></>);
  }
  const isOwner = me.ok && me.data.role === "owner";
  const p = pres.data.presenter;
  const titleOf = Object.fromEntries(approved.data.scripts.map((s) => [s.id, s.title_yo || s.title_en]));
  const runTone = (s: ProductionRun["status"]) => (s === "completed" ? "green" : s === "queued" || s === "running" ? "neutral" : "red");

  return (
    <>
      <PageHeader
        title={t.nav.voice}
        subtitle={v.subtitle}
        badge={p ? <Badge tone={p.status === "approved" ? "green" : "gold"}>{v.status[p.status]}</Badge> : null}
      />
      {!isOwner && <div className="mb-5"><Alert tone="warn">{v.ownerOnly}</Alert></div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title={v.presenter}>
            {isOwner ? <PresenterForm t={v} p={p} /> : p && (
              <dl className="space-y-1 text-sm"><dt className="font-semibold" lang="yo">{p.name}</dt><dd>{p.description}</dd></dl>
            )}
          </Card>

          <Card title={v.tests}>
            <p className="-mt-2 mb-3 text-xs text-charcoal-400">{v.testHelp}</p>
            {isOwner && p && <RequestTestForm t={v} jobLabels={t.jobs} />}
            <ul className="mt-4 space-y-4">
              {tests.data.tests.length === 0 && <li className="text-sm text-charcoal-400">{v.noTests}</li>}
              {tests.data.tests.map((x) => (
                <li key={x.id} className="rounded-md border border-navy-100 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-charcoal-400">
                    <Badge tone={x.status === "passed" ? "green" : x.status === "awaiting_review" ? "gold" : x.status === "generating" ? "neutral" : "red"}>{v.testStatus[x.status]}</Badge>
                    {x.is_sample && <Badge tone="gold">{t.episodes.sample}</Badge>}
                    {p && x.voice_config_hash !== p.voice_config_hash && <Badge>{v.olderVoice}</Badge>}
                    <span>{formatDateTime(x.created_at, locale)} · {formatUsdPrecise(x.cost_usd, locale)}</span>
                  </div>
                  {x.audio_asset_id && <audio controls preload="none" src={`/media/${x.audio_asset_id}`} className="mt-2 w-full" />}
                  {x.is_sample && x.audio_asset_id && <p className="mt-1 text-xs text-charcoal-400">{v.sampleNote}</p>}
                  {x.error && <p className="mt-2 text-sm text-red-800">{x.error}</p>}
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-xs text-navy">{v.passage}</summary>
                    <ol className="mt-2 list-decimal space-y-1 pl-5" lang="yo">{x.passage.map((i) => <li key={i.id}>{i.text}</li>)}</ol>
                  </details>
                  {x.reviewed_by && <p className="mt-2 text-xs">{x.reviewed_by}{x.notes ? `: “${x.notes}”` : ""}</p>}
                  {x.status === "awaiting_review" && p && x.voice_config_hash === p.voice_config_hash && <RateTestForm t={v} test={x} />}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title={v.portrait}>
            {p?.has_portrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/voice/portrait?v=${p.portrait_sha256}`} alt={p.name} className="mb-3 aspect-square w-full rounded-md object-cover" />
            ) : (
              <p className="mb-3 text-sm text-charcoal-400">{v.noPortrait}</p>
            )}
            {isOwner && p && <PortraitForm t={v} />}
          </Card>
          {p && (
            <Card title={v.status[p.status]}>
              {p.status === "approved" && p.approved_by && p.approved_at ? (
                <p className="text-sm text-emerald-800">✓ {fmt(v.approvedBy, { who: p.approved_by, when: formatDateTime(p.approved_at, locale) })}</p>
              ) : (
                <>
                  <ul className="mb-3 list-disc space-y-1 pl-5 text-sm">
                    {p.problems.map((x) => <li key={x}>{(v.problems as Record<string, string>)[x] ?? x}</li>)}
                  </ul>
                  {isOwner && <ApproveForm t={v} />}
                </>
              )}
            </Card>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card title={v.readyScripts}>
          <p className="-mt-2 mb-3 text-xs text-charcoal-400">{v.productionHelp}</p>
          <ul className="divide-y divide-navy-50 text-sm">
            {approved.data.scripts.length === 0 && <li className="py-2 text-charcoal-400">{v.noReady}</li>}
            {approved.data.scripts.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/scripts/${s.id}`} lang="yo" className="font-medium text-navy underline decoration-gold/60 underline-offset-2">{s.title_yo || s.title_en}</Link>
                {isOwner && p?.status === "approved" && <ProduceForm t={v} scriptId={s.id} />}
              </li>
            ))}
          </ul>
        </Card>
        <Card title={v.runs}>
          <ul className="divide-y divide-navy-50 text-sm">
            {runs.data.runs.length === 0 && <li className="py-2 text-charcoal-400">{v.noRuns}</li>}
            {runs.data.runs.map((r) => {
              const { min, sec } = minutesSeconds(r.duration_seconds);
              return (
                <li key={r.id} className="py-2">
                  <Link href={`/voice/runs/${r.id}`} lang="yo" className="font-medium text-navy underline decoration-gold/60 underline-offset-2">
                    {titleOf[r.script_id] ?? r.script_id.slice(0, 8)} · {t.scripts.colRevision} {r.script_revision}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-charcoal-400">
                    <Badge tone={runTone(r.status)}>{v.runStatus[r.status]}</Badge>
                    {r.is_sample && <Badge tone="gold">{t.episodes.sample}</Badge>}
                    <span>{min}:{String(sec).padStart(2, "0")} · {formatUsdPrecise(r.total_cost_usd, locale)} · {formatDateTime(r.created_at, locale)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
