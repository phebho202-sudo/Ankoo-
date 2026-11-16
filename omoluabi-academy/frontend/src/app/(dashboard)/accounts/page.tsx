import { ActionButton } from "@/components/PublishingForms";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import type { AccountsList } from "@/lib/api";
import { fmt, formatDateTime } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { OAUTH_KEYS, PROVIDER_PLATFORMS } from "@/lib/publishing";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const sp = await searchParams;
  const { locale, t } = await getI18n();
  const a = t.accounts;
  const res = await authedFetch<AccountsList>("/api/v1/accounts");
  if (!res.ok) return (<><PageHeader title={t.nav.accounts} /><Alert tone="error">{t.common.unreachable}</Alert></>);
  const data = res.data;
  const tone = (s: string) => (s === "connected" ? "green" : s === "expired" ? "red" : "neutral");

  return (
    <>
      <PageHeader title={t.nav.accounts} subtitle={a.subtitle} />
      <div className="mb-5 space-y-3">
        {sp.connected && <Alert tone="ok">{fmt(a.connected, { n: sp.connected })}</Alert>}
        {sp.error && <Alert tone="error">{fmt(a.connectFailed, { msg: sp.error })}</Alert>}
        {data.sample_mode && <Alert tone="warn">{a.sampleMode}</Alert>}
        {!data.sample_mode && !data.token_encryption_configured && <Alert tone="error">{a.noEncryption}</Alert>}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {(["google", "meta", "tiktok"] as const).map((provider) => {
          const platforms = PROVIDER_PLATFORMS[provider];
          const accounts = data.accounts.filter((x) => platforms.includes(x.platform) && x.status !== "disconnected");
          const configured = data.oauth_configured.includes(provider);
          return (
            <Card key={provider} title={a.providers[provider]}>
              <div className="space-y-3 text-sm" data-provider={provider}>
                <p className="text-xs text-charcoal-400">{a.notes[provider]}</p>
                {accounts.length === 0 && <p className="text-charcoal-400">{a.noAccounts}</p>}
                <ul className="space-y-3">
                  {accounts.map((acc) => (
                    <li key={acc.id} className="rounded-md border border-navy-50 p-3" data-account={acc.platform}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-navy" lang="yo">{a.platformNames[acc.platform]} · {acc.display_name}</span>
                        <div className="flex gap-1">
                          {acc.is_sample && <Badge tone="gold">{t.episodes.sample}</Badge>}
                          <Badge tone={tone(acc.status)}>{a.status[acc.status]}</Badge>
                        </div>
                      </div>
                      {!acc.is_sample && (
                        <p className="mt-1 text-xs text-charcoal-400">
                          {acc.token_expires_at ? fmt(a.expires, { when: formatDateTime(acc.token_expires_at, locale) }) : a.noExpiry}
                          {acc.has_refresh_token && ` · ${a.refreshable}`}
                        </p>
                      )}
                      {acc.last_error && <p className="mt-1 text-xs text-red-800">{fmt(a.lastError, { msg: acc.last_error })}</p>}
                      <div className="mt-2"><ActionButton action="disconnect" fields={{ id: acc.id }} text={a.disconnect} /></div>
                    </li>
                  ))}
                </ul>
                {data.sample_mode ? (
                  <div className="flex flex-wrap gap-2">
                    {platforms.map((p) => (
                      <ActionButton key={p} action="connectSample" fields={{ platform: p }} text={`${a.connectSample}: ${a.platformNames[p as keyof typeof a.platformNames]}`} />
                    ))}
                  </div>
                ) : configured ? (
                  <ActionButton action="connect" fields={{ provider }} text={a.connect} primary />
                ) : (
                  <div className="rounded-md bg-cream-50 p-3 text-xs">
                    <p>{a.notConfigured}</p>
                    <code className="mt-1 block break-all">{OAUTH_KEYS[provider]}</code>
                  </div>
                )}
                {!data.sample_mode && (
                  <div className="text-xs text-charcoal-400">
                    <p>{a.redirect}</p>
                    <code className="block break-all">{data.redirect_uris[provider]}</code>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
