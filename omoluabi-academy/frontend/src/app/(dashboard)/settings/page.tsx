import Link from "next/link";
import { Alert, Card, PageHeader } from "@/components/ui";
import type { AuditEntry, SettingItem } from "@/lib/api";
import { formatDateTime } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { authedFetch } from "@/lib/session";
import { SettingRow, type SettingRowLabels } from "./SettingRow";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER = ["budget", "storage", "publishing", "production"] as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const { locale, t } = await getI18n();
  const s = t.settings;
  const { before } = await searchParams;
  const beforeId = before && /^\d+$/.test(before) ? before : undefined;

  const [settings, auditLog] = await Promise.all([
    authedFetch<{ settings: SettingItem[] }>("/api/v1/settings"),
    authedFetch<{ entries: AuditEntry[]; next_before_id: number | null }>(
      `/api/v1/audit?limit=25${beforeId ? `&before_id=${beforeId}` : ""}`,
    ),
  ]);

  const labelsFor = (item: SettingItem): SettingRowLabels => ({
    label: s.labels[item.key] ?? item.key,
    help: s.help[item.key] ?? item.description,
    save: t.common.save,
    saving: t.common.saving,
    saved: t.common.saved,
    default: s.default,
    custom: s.custom,
    changedBy: s.changedBy,
    spendingLimit: s.spendingLimit,
    range: s.range,
    confirmIncrease: s.confirmIncrease,
    needsConfirmation: s.needsConfirmation,
    autoPublishBlocked: s.autoPublishBlocked,
    invalid: s.invalid,
    failed: s.failed,
    on: s.on,
    off: s.off,
    choices: s.choices,
  });

  return (
    <>
      <PageHeader title={s.title} subtitle={s.subtitle} />
      {!settings.ok ? (
        <Alert tone="error">{t.common.unreachable}</Alert>
      ) : (
        <div className="space-y-5">
          {CATEGORY_ORDER.map((cat) => {
            const items = settings.data.settings.filter((i) => i.category === cat);
            if (items.length === 0) return null;
            return (
              <Card key={cat} title={s.categories[cat]}>
                <div className="divide-y divide-navy-50">
                  {items.map((item) => (
                    // key includes the value so the form resets to the saved value after revalidation
                    <SettingRow key={`${item.key}:${String(item.value)}`} item={item} labels={labelsFor(item)} />
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div id="audit" className="mt-8 scroll-mt-6">
        <Card title={s.audit}>
          <p className="-mt-2 mb-4 text-sm text-charcoal-400">{s.auditSubtitle}</p>
          {!auditLog.ok ? (
            <Alert tone="error">{t.common.unreachable}</Alert>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="border-b border-navy-100 text-xs uppercase tracking-wider text-charcoal-400">
                    <tr>
                      <th className="py-2 pr-4 font-medium">{s.time}</th>
                      <th className="py-2 pr-4 font-medium">{s.action}</th>
                      <th className="py-2 pr-4 font-medium">{s.item}</th>
                      <th className="py-2 font-medium">{s.actor}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-50">
                    {auditLog.data.entries.map((e) => (
                      <tr key={e.id} className="align-top">
                        <td className="whitespace-nowrap py-2 pr-4 text-xs tabular-nums text-charcoal-400">
                          {formatDateTime(e.occurred_at, locale)}
                        </td>
                        <td className="py-2 pr-4">
                          <code className="rounded bg-navy-50 px-1.5 py-0.5 text-xs text-navy">{e.action}</code>
                        </td>
                        <td className="max-w-[16rem] truncate py-2 pr-4 text-xs">
                          {e.entity_id ?? "—"}
                          {"old" in e.details && "new" in e.details && (
                            <span className="ml-1 text-charcoal-400">
                              ({String(e.details.old)} → {String(e.details.new)})
                            </span>
                          )}
                        </td>
                        <td className="max-w-[14rem] truncate py-2 text-xs text-charcoal-400">{e.actor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex gap-4 text-sm">
                {beforeId && (
                  <Link href="/settings#audit" className="font-medium text-navy underline decoration-gold underline-offset-4">
                    {s.newest}
                  </Link>
                )}
                {auditLog.data.next_before_id && (
                  <Link
                    href={`/settings?before=${auditLog.data.next_before_id}#audit`}
                    className="font-medium text-navy underline decoration-gold underline-offset-4"
                  >
                    {s.older} →
                  </Link>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
