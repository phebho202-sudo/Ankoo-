import Link from "next/link";
import { notFound } from "next/navigation";
import { GrantBadges, StateBadge } from "@/components/GrantBadges";
import { DocumentUpload, LicenceForm, RevokeForm, ScopeForm, VerifyForm } from "@/components/RightsForms";
import { Alert, Card, PageHeader } from "@/components/ui";
import type { Channel, EpisodeSummary, LicenceDetail } from "@/lib/api";
import { fmt, formatDate, formatDateTime } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LicencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { locale, t } = await getI18n();
  const r = t.rights;
  const [res, chans, eps] = await Promise.all([
    authedFetch<LicenceDetail>(`/api/v1/rights/licences/${encodeURIComponent(id)}`),
    authedFetch<{ channels: Channel[] }>("/api/v1/channels"),
    authedFetch<{ episodes: EpisodeSummary[] }>("/api/v1/episodes?limit=100"),
  ]);
  if (!res.ok && res.httpStatus === 404) notFound();
  if (!res.ok || !chans.ok || !eps.ok) return <Alert tone="error">{t.common.unreachable}</Alert>;
  const lic = res.data;
  const revoked = lic.status === "revoked";

  return (
    <>
      <Link href="/rights" className="mb-3 inline-block text-sm text-navy underline decoration-gold underline-offset-4">
        ← {r.back}
      </Link>
      <PageHeader
        title={lic.licence_reference}
        subtitle={`${lic.licensor_name} · ${formatDate(lic.effective_from, locale)} → ${formatDate(lic.expires_at, locale)}`}
        badge={<StateBadge t={r} state={lic.state} />}
      />
      <div className="mb-5 space-y-3">
        <GrantBadges t={r} grants={lic} />
        {lic.verified_by && lic.verified_at && !revoked && (
          <p className="text-sm text-emerald-800">✓ {fmt(r.verifiedBy, { who: lic.verified_by, when: formatDateTime(lic.verified_at, locale) })}</p>
        )}
        {revoked && (
          <Alert tone="error">
            {fmt(r.revokedBy, { who: lic.revoked_by ?? "", when: formatDateTime(lic.revoked_at ?? "", locale), reason: lic.revoked_reason ?? "" })}
          </Alert>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {!revoked && (
            <Card title={r.form.details}>
              <LicenceForm t={r} licence={lic} />
            </Card>
          )}
          <Card title={r.scope}>
            {revoked ? (
              <p className="text-sm">
                {lic.channel_title && fmt(r.wholeChannel, { channel: lic.channel_title })} {lic.episodes.map((e) => e.title).join(", ")}
              </p>
            ) : (
              <ScopeForm t={r} licence={lic} channels={chans.data.channels} episodes={eps.data.episodes} />
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title={r.document}>
            {lic.document ? (
              <div className="mb-4 space-y-1 text-sm">
                <a href={`/rights/${lic.id}/document`} target="_blank" rel="noopener" className="font-medium text-navy underline decoration-gold underline-offset-4">
                  {r.openDocument}: {lic.document.filename}
                </a>
                <p className="text-xs text-charcoal-400">
                  {lic.document.size < 1024 ? `${lic.document.size} B` : `${Math.round(lic.document.size / 1024).toLocaleString()} KB`}
                </p>
                <p className="break-all text-[11px] text-charcoal-400">
                  {r.fingerprint}: {lic.document.sha256}
                </p>
              </div>
            ) : (
              <p className="mb-4 text-sm">{r.noDocument}</p>
            )}
            {!revoked && <DocumentUpload t={r} id={lic.id} />}
          </Card>
          {lic.status === "draft" && (
            <Card title={r.verification}>
              <VerifyForm t={r} id={lic.id} problems={lic.problems} />
            </Card>
          )}
          {!revoked && (
            <Card title={r.revoke}>
              <RevokeForm t={r} id={lic.id} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
