import { PageHeader, Card } from "@/components/ui";
import { fmt } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { phaseOf, type PlaceholderKey } from "@/lib/nav";

// An honest "not built yet" page: explains the purpose and safeguards, shows no fake data.
export async function PlaceholderPage({ page }: { page: PlaceholderKey }) {
  const { t } = await getI18n();
  const phase = phaseOf(page);
  const content = t.pages[page];
  return (
    <>
      <PageHeader
        title={t.nav[page]}
        badge={
          <span className="rounded-full bg-gold-100 px-3 py-1 text-xs font-semibold text-gold-600">
            {t.common.notBuiltYet} · {fmt(t.common.phase, { n: phase })}
          </span>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={t.placeholder.whatItWillDo} className="lg:col-span-2">
          <p className="text-[15px] leading-relaxed">{content.purpose}</p>
          <div className="mt-6 rounded-md border border-dashed border-navy-100 bg-cream-50 px-4 py-8 text-center text-sm text-charcoal-400">
            {fmt(t.placeholder.empty, { n: phase })}
          </div>
        </Card>
        <Card title={t.placeholder.safeguards}>
          <ul className="space-y-3 text-sm">
            {content.safeguards.map((s) => (
              <li key={s} className="flex gap-2">
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
