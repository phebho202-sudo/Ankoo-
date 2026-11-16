import Link from "next/link";
import { entryAction } from "@/app/script-actions";
import { PronForm, TermForm } from "@/components/ScriptForms";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import type { GlossaryTerm, PronEntry } from "@/lib/api";
import { getI18n } from "@/lib/i18n/server";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";

function Actions({ kind, id, approved, t }: { kind: "glossary" | "pronunciation"; id: string; approved: boolean; t: { approve: string; remove: string } }) {
  return (
    <div className="flex gap-2">
      {!approved && (
        <form action={entryAction}>
          <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value="approve" />
          <button className="rounded border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-50">{t.approve}</button>
        </form>
      )}
      <form action={entryAction}>
        <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value="delete" />
        <button className="rounded px-2 py-1 text-xs text-red-800 hover:bg-red-50">{t.remove}</button>
      </form>
    </div>
  );
}

export default async function DictionaryPage() {
  const { t } = await getI18n();
  const d = t.dictionary;
  const [g, p] = await Promise.all([
    authedFetch<{ terms: GlossaryTerm[] }>("/api/v1/glossary"),
    authedFetch<{ entries: PronEntry[] }>("/api/v1/pronunciations"),
  ]);
  if (!g.ok || !p.ok) return <Alert tone="error">{t.common.unreachable}</Alert>;
  const status = (s: "proposed" | "approved") => <Badge tone={s === "approved" ? "green" : "gold"}>{d[s]}</Badge>;
  return (
    <>
      <Link href="/scripts" className="mb-3 inline-block text-sm text-navy underline decoration-gold underline-offset-4">← {t.scripts.back}</Link>
      <PageHeader title={d.title} subtitle={d.subtitle} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={d.glossary}>
          <TermForm t={d} />
          <ul className="mt-4 divide-y divide-navy-50 text-sm">
            {g.data.terms.length === 0 && <li className="py-2 text-charcoal-400">{d.empty}</li>}
            {g.data.terms.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {x.english} → <strong lang="yo">{x.yoruba}</strong> {status(x.status)}
                  {x.notes && <span className="block text-xs text-charcoal-400">{x.notes}</span>}
                </span>
                <Actions kind="glossary" id={x.id} approved={x.status === "approved"} t={d} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title={d.pronunciation}>
          <PronForm t={d} />
          <ul className="mt-4 divide-y divide-navy-50 text-sm">
            {p.data.entries.length === 0 && <li className="py-2 text-charcoal-400">{d.empty}</li>}
            {p.data.entries.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {x.written} → <strong lang="yo">{x.spoken}</strong> <Badge>{(d.categories as Record<string, string>)[x.category] ?? x.category}</Badge> {status(x.status)}
                </span>
                <Actions kind="pronunciation" id={x.id} approved={x.status === "approved"} t={d} />
              </li>
            ))}
          </ul>
          <a href="/scripts/dictionary/lexicon" className="mt-4 inline-block text-sm text-navy underline decoration-gold underline-offset-4">{d.exportPls}</a>
        </Card>
      </div>
    </>
  );
}
