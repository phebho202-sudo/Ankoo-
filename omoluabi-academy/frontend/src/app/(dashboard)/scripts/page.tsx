import Link from "next/link";
import { NewScriptForm } from "@/components/ScriptForms";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import type { EpisodeSummary, ScriptStatus, ScriptSummary, TopicItem, User } from "@/lib/api";
import { formatDateTime } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { statusTone } from "@/lib/scripts";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";
const FILTERS: ScriptStatus[] = ["draft", "in_review", "changes_requested", "approved", "blocked"];

export default async function ScriptsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { locale, t } = await getI18n();
  const st = t.scripts;
  const { status } = await searchParams;
  const filter = FILTERS.find((f) => f === status);
  const [me, list] = await Promise.all([
    authedFetch<User>("/api/v1/auth/me"),
    authedFetch<{ scripts: ScriptSummary[] }>(`/api/v1/scripts${filter ? `?status=${filter}` : ""}`),
  ]);
  const isOwner = me.ok && me.data.role === "owner";
  const [topics, eps] = isOwner
    ? await Promise.all([
        authedFetch<{ topics: TopicItem[] }>("/api/v1/topics?status=approved&limit=200"),
        authedFetch<{ episodes: EpisodeSummary[] }>("/api/v1/episodes?limit=100"),
      ])
    : [null, null];
  if (!list.ok) {
    return (
      <>
        <PageHeader title={t.nav.scripts} />
        <Alert tone="error">{t.common.unreachable}</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t.nav.scripts}
        subtitle={st.subtitle}
        badge={
          <Link href="/scripts/dictionary" className="text-sm font-medium text-navy underline decoration-gold underline-offset-4">
            {st.dictionaryLink} →
          </Link>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <nav className="mb-4 flex flex-wrap gap-2 text-sm" aria-label={st.colKind}>
              {[undefined, ...FILTERS].map((f) => (
                <Link
                  key={f ?? "all"}
                  href={f ? `/scripts?status=${f}` : "/scripts"}
                  aria-current={f === filter ? "page" : undefined}
                  className={`rounded-full px-3 py-1 ${f === filter ? "bg-navy text-cream" : "bg-navy-50 text-navy hover:bg-navy-100"}`}
                >
                  {f ? st.status[f] : st.all}
                </Link>
              ))}
            </nav>
            {list.data.scripts.length === 0 ? (
              <p className="text-sm text-charcoal-400">{st.none}</p>
            ) : (
              <ul className="divide-y divide-navy-50">
                {list.data.scripts.map((s) => (
                  <li key={s.id} className="py-3">
                    <Link href={`/scripts/${s.id}`} className="font-medium text-navy underline decoration-gold/60 underline-offset-2" lang="yo">
                      {s.title_yo || s.title_en}
                    </Link>
                    {s.title_yo && <div className="text-xs text-charcoal-400">{s.title_en}</div>}
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-charcoal-400">
                      <Badge tone={statusTone(s.status)}>{st.status[s.status]}</Badge>
                      <Badge>{st.kinds[s.kind]}</Badge>
                      {s.is_sample && <Badge tone="gold">{t.episodes.sample}</Badge>}
                      {s.score !== null && (
                        <Badge tone={s.error_count ? "red" : s.score >= 85 ? "green" : "gold"}>
                          {st.score}: {s.score}
                        </Badge>
                      )}
                      <span>
                        {st.colRevision} {s.current_revision} · {formatDateTime(s.updated_at, locale)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        {isOwner && topics?.ok && eps?.ok && (
          <Card title={st.newScript}>
            <NewScriptForm t={st} topics={topics.data.topics} episodes={eps.data.episodes.filter((e) => e.has_transcript)} />
          </Card>
        )}
      </div>
    </>
  );
}
