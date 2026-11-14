import { StatusPill } from "@/components/StatusPill";
import { Alert, Card, PageHeader } from "@/components/ui";
import { getReadiness, type Overview } from "@/lib/api";
import { fmt, formatDateTime, formatUsd } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";

const JOB_ORDER = ["queued", "running", "succeeded", "failed", "blocked"] as const;

export default async function OverviewPage() {
  const { locale, t } = await getI18n();
  const [ready, ov] = await Promise.all([getReadiness(), authedFetch<Overview>("/api/v1/overview")]);
  const o = t.overview;

  return (
    <>
      <PageHeader
        title={o.title}
        subtitle={o.subtitle}
        badge={
          ov.ok ? (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                ov.data.provider_mode === "sample" ? "bg-gold-100 text-gold-600" : "bg-navy text-cream"
              }`}
            >
              {ov.data.provider_mode === "sample" ? o.sampleMode : o.liveMode}
            </span>
          ) : null
        }
      />

      {!ov.ok ? (
        <Alert tone="error">{t.common.unreachable}</Alert>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title={o.health}>
            <div className="flex flex-wrap gap-2">
              <StatusPill ok={ready.ok && ready.data.status === "ok"} label={o.api} okText={t.common.ok} downText={t.common.down} />
              <StatusPill ok={ready.ok && !!ready.data.checks.database?.ok} label={o.database} okText={t.common.ok} downText={t.common.down} />
              <StatusPill ok={ready.ok && !!ready.data.checks.redis?.ok} label={o.redis} okText={t.common.ok} downText={t.common.down} />
            </div>
            <p className="mt-4 text-xs text-charcoal-400">
              {o.environment}: <span className="font-medium text-charcoal">{ov.data.environment}</span>
            </p>
          </Card>

          <BudgetCard ov={ov.data} locale={locale} t={o} />

          <Card title={o.audit}>
            {ov.data.audit.ok ? (
              <p className="flex items-start gap-2 text-sm text-emerald-900">
                <span aria-hidden className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-600" />
                {fmt(o.auditOk, { n: ov.data.audit.entries })}
              </p>
            ) : (
              <Alert tone="error">{o.auditBad}</Alert>
            )}
          </Card>

          <Card title={o.jobs}>
            <dl className="grid grid-cols-2 gap-3">
              {JOB_ORDER.map((s) => (
                <div key={s} className="rounded-md bg-cream-50 px-3 py-2">
                  <dt className="text-xs text-charcoal-400">{o.jobStatus[s]}</dt>
                  <dd className="text-xl font-semibold tabular-nums text-navy">{ov.data.jobs[s] ?? 0}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title={o.setup}>
            <ul className="space-y-2 text-sm">
              {ov.data.setup_checklist.map((c) => (
                <li key={c.key} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                      c.done ? "bg-emerald-600 text-white" : "border-2 border-navy-100"
                    }`}
                  >
                    {c.done ? "✓" : ""}
                  </span>
                  <span className={c.done ? "" : "text-charcoal-400"}>
                    {o.checklist[c.key as keyof typeof o.checklist] ?? c.key}
                    <span className="sr-only">: {c.done ? t.common.yes : t.common.no}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-charcoal-400">{o.setupNote}</p>
          </Card>

          <Card title={o.providers}>
            <ul className="divide-y divide-navy-50 text-sm">
              {ov.data.providers.map((p) => {
                const state = p.is_sample ? o.providerState.sample : p.configured ? o.providerState.connected : o.providerState.notConfigured;
                const tone = p.is_sample ? "bg-gold-100 text-gold-600" : p.configured ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900";
                return (
                  <li key={p.capability} className="flex items-center justify-between gap-2 py-2">
                    <span>{o.capability[p.capability as keyof typeof o.capability] ?? p.capability}</span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${tone}`} title={p.detail}>
                      {state}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title={o.recent} className="lg:col-span-3">
            {ov.data.recent_activity.length === 0 ? (
              <p className="text-sm text-charcoal-400">{o.noActivity}</p>
            ) : (
              <ul className="divide-y divide-navy-50 text-sm">
                {ov.data.recent_activity.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2">
                    <time className="w-40 shrink-0 text-xs tabular-nums text-charcoal-400" dateTime={e.occurred_at}>
                      {formatDateTime(e.occurred_at, locale)}
                    </time>
                    <code className="rounded bg-navy-50 px-1.5 py-0.5 text-xs text-navy">{e.action}</code>
                    <span className="truncate text-xs text-charcoal-400">{e.actor}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function BudgetCard({
  ov,
  locale,
  t,
}: {
  ov: Overview;
  locale: "en" | "yo";
  t: Awaited<ReturnType<typeof getI18n>>["t"]["overview"];
}) {
  const used = ov.budget.used_percent ?? 0;
  const alert = ov.budget.alert_threshold_percent;
  const barColour = used >= 100 ? "bg-red-600" : used >= alert ? "bg-gold" : "bg-navy";
  return (
    <Card title={t.spend}>
      <p className="text-3xl font-semibold tabular-nums text-navy">{formatUsd(ov.budget.spent_usd, locale)}</p>
      <p className="text-sm text-charcoal-400">{fmt(t.ofLimit, { limit: formatUsd(ov.budget.limit_usd, locale) })}</p>
      <div
        className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-navy-50"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, used)}
      >
        <div className={`h-full ${barColour}`} style={{ width: `${Math.min(100, used)}%` }} />
        <div className="absolute inset-y-0 w-0.5 bg-gold-600" style={{ left: `${alert}%` }} aria-hidden />
      </div>
      <p className="mt-2 flex justify-between text-xs text-charcoal-400">
        <span>{used}%</span>
        <span>{fmt(t.alertAt, { pct: alert })}</span>
      </p>
      <p className="mt-3 text-xs text-charcoal-400">{t.spendNote}</p>
    </Card>
  );
}
