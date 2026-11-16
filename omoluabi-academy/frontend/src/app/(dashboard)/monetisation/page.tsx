import { field, label, MonForm } from "@/components/MonetisationForms";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import type { MonetisationOverview, VideoList } from "@/lib/api";
import { fmt } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";

function Currency({ name, l }: { name: string; l: string }) {
  return (
    <label className={label}>{l}
      <select name={name} className={field}><option value="NGN">NGN (₦)</option><option value="USD">USD ($)</option></select>
    </label>
  );
}

export default async function MonetisationPage() {
  const { locale, t } = await getI18n();
  const m = t.money;
  const [res, vids] = await Promise.all([
    authedFetch<MonetisationOverview>("/api/v1/monetisation"),
    authedFetch<VideoList>("/api/v1/videos"),
  ]);
  if (!res.ok) return (<><PageHeader title={t.nav.monetisation} /><Alert tone="error">{t.common.unreachable}</Alert></>);
  const d = res.data;
  const pay = d.payments;
  const today = new Date().toISOString().slice(0, 10);
  const approvedVideos = vids.ok ? vids.data.videos.filter((v) => v.status === "approved") : [];
  const productName = Object.fromEntries(d.products.map((p) => [p.id, locale === "yo" ? p.name_yo : p.name_en]));

  return (
    <>
      <PageHeader title={t.nav.monetisation} subtitle={m.subtitle} />
      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        <Alert tone="warn">{m.youtubeNote}</Alert>
        <div className="rounded-lg border border-navy-100 bg-white p-4 text-sm" data-testid="payments">
          <p className="font-semibold text-navy">{m.payments}: Paystack</p>
          <p className="mt-1">{pay.sample_mode ? m.paymentsSample : !pay.configured ? m.paymentsNotConfigured : pay.test_key ? m.paymentsTest : m.paymentsLive}</p>
          {!pay.sample_mode && <p className="mt-2 text-xs text-charcoal-400">{m.webhook} <code className="break-all">{pay.webhook_url}</code></p>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={m.revenue}>
          <MonForm action="revenue" submit={m.record} ok={m.recorded} testId="revenue-form">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>{m.source}
                <select name="source" className={field}>{Object.entries(m.sources).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </label>
              <label className={label}>{m.date}<input type="date" name="occurred_on" required max={today} defaultValue={today} className={field} /></label>
              <label className={label}>{m.amount}<input name="amount" required inputMode="decimal" placeholder="2,500.00" className={field} /></label>
              <Currency name="currency" l={m.currency} />
            </div>
            <label className={label}>{m.descriptionLabel}<input name="description" maxLength={1000} className={field} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>{m.reference}<input name="reference" maxLength={120} className={field} /></label>
              <label className={label}>{m.link}
                <select name="link_id" className={field}><option value="">{m.none}</option>{d.links.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              </label>
            </div>
          </MonForm>
          <ul className="mt-4 divide-y divide-navy-50 text-sm" data-testid="revenue-list">
            {d.revenue.length === 0 && <li className="py-2 text-charcoal-400">{m.noRevenue}</li>}
            {d.revenue.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{r.occurred_on} · {(m.sources as Record<string, string>)[r.source]} {r.description && `· ${r.description}`} <span className="text-xs text-charcoal-400">{fmt(m.by, { who: r.created_by })}</span></span>
                <span className="font-medium tabular-nums">{formatMoney(r.amount_minor, r.currency, locale)} {r.is_estimate && <Badge tone="gold">{m.estimate}</Badge>}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={m.links}>
          <p className="-mt-2 mb-3 text-xs text-charcoal-400">{m.linkHelp}</p>
          <ul className="mb-4 space-y-3 text-sm" data-testid="links">
            {d.links.length === 0 && <li className="text-charcoal-400">{m.noLinks}</li>}
            {d.links.map((l) => (
              <li key={l.id} className="rounded-md border border-navy-50 p-3" data-link={l.slug}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-navy">{l.name} · {l.partner}</span>
                  <span className="flex gap-1">{!l.active && <Badge tone="neutral">{m.paused}</Badge>}<Badge tone="navy">{fmt(m.clicks, { n: l.clicks })}</Badge></span>
                </div>
                <code className="mt-1 block break-all text-xs">{l.public_path}</code>
                <p className="mt-1 text-xs" lang="yo">{l.disclosure_yo}</p>
                <p className="text-xs text-charcoal-400">{l.disclosure_en}</p>
              </li>
            ))}
          </ul>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-navy">{m.addLink}</summary>
            <div className="mt-3">
              <MonForm action="link" submit={m.addLink} ok={m.recorded} testId="link-form">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={label}>{m.slug}<input name="slug" required pattern="[a-z0-9][a-z0-9-]{1,58}[a-z0-9]" className={field} /></label>
                  <label className={label}>{m.name}<input name="name" required className={field} /></label>
                  <label className={label}>{m.partner}<input name="partner" required className={field} /></label>
                  <label className={label}>{m.destination}<input name="destination_url" type="url" required pattern="https://.*" className={field} /></label>
                </div>
                <label className={label}>{m.disclosureYo}<textarea name="disclosure_yo" lang="yo" required rows={2} className={field} /></label>
                <label className={label}>{m.disclosureEn}<textarea name="disclosure_en" required rows={2} className={field} /></label>
                <label className={label}>{m.commission}<input name="commission_note" className={field} /></label>
              </MonForm>
            </div>
          </details>
        </Card>

        <Card title={m.products}>
          <ul className="mb-4 space-y-3 text-sm" data-testid="products">
            {d.products.length === 0 && <li className="text-charcoal-400">{m.noProducts}</li>}
            {d.products.map((p) => (
              <li key={p.id} className="rounded-md border border-navy-50 p-3" data-product={p.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-navy" lang="yo">{p.name_yo} <span className="text-charcoal-400">· {p.name_en}</span></span>
                  <span className="flex gap-1"><Badge tone={p.status === "active" ? "green" : "neutral"}>{m.productStatus[p.status]}</Badge></span>
                </div>
                <p className="mt-1 text-xs">{(m.kinds as Record<string, string>)[p.kind]} · <span className="tabular-nums">{formatMoney(p.price_minor, p.currency, locale)}</span></p>
                {p.status === "active" && (
                  <div className="mt-2">
                    <MonForm action="checkout" submit={m.createCheckout} secondary checkoutLabels={{ ready: m.checkoutReady, sample: m.checkoutSample }} testId="checkout-form">
                      <input type="hidden" name="id" value={p.id} />
                      <label className={label}>{m.buyerEmail}<input name="email" type="email" required className={field} /></label>
                    </MonForm>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-navy">{m.addProduct}</summary>
            <div className="mt-3">
              <MonForm action="product" submit={m.addProduct} ok={m.recorded} testId="product-form">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={label}>{m.nameYo}<input name="name_yo" lang="yo" required className={field} /></label>
                  <label className={label}>{m.nameEn}<input name="name_en" required className={field} /></label>
                  <label className={label}>{m.kind}<select name="kind" className={field}>{Object.entries(m.kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                  <label className={label}>{m.status}<select name="status" className={field}>{Object.entries(m.productStatus).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                  <label className={label}>{m.price}<input name="price" required inputMode="decimal" placeholder="2,500" className={field} /></label>
                  <Currency name="currency" l={m.currency} />
                </div>
                <label className={label}>{m.delivery}<input name="delivery_note" className={field} /></label>
              </MonForm>
            </div>
          </details>
          {d.orders.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-navy">{m.orders}</h3>
              <ul className="mt-2 divide-y divide-navy-50 text-xs">
                {d.orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                    <span>{o.reference} · {productName[o.product_id]}</span>
                    <span className="flex gap-1">{o.is_sample && <Badge tone="gold">{t.episodes.sample}</Badge>}<Badge tone={o.status === "paid" ? "green" : "neutral"}>{m.orderStatus[o.status]}</Badge> {formatMoney(o.amount_minor, o.currency, locale)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title={m.sponsorships}>
          <p className="-mt-2 mb-3 text-xs text-charcoal-400">{m.sponsorHelp}</p>
          <ul className="mb-4 space-y-3 text-sm" data-testid="sponsorships">
            {d.sponsorships.length === 0 && <li className="text-charcoal-400">{m.noSponsorships}</li>}
            {d.sponsorships.map((sp) => (
              <li key={sp.id} className="rounded-md border border-navy-50 p-3" data-sponsorship={sp.status}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-navy">{sp.sponsor_name}</span>
                  <span className="flex items-center gap-1"><Badge tone={sp.status === "paid" ? "green" : sp.status === "cancelled" ? "neutral" : "gold"}>{m.sponsorStatus[sp.status]}</Badge> <span className="tabular-nums">{formatMoney(sp.value_minor, sp.currency, locale)}</span></span>
                </div>
                <p className="mt-1 text-xs">{sp.deliverables}</p>
                {sp.contract_reference && <p className="text-xs text-charcoal-400">{m.contract}: {sp.contract_reference}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {sp.next.map((n) => (
                    <MonForm key={n} action="sponsorStatus" submit={fmt(m.moveTo, { status: (m.sponsorStatus as Record<string, string>)[n] })} secondary>
                      <input type="hidden" name="id" value={sp.id} />
                      <input type="hidden" name="status" value={n} />
                      {n === "agreed" && <label className={label}>{m.contract}<input name="contract_reference" required className={field} /></label>}
                    </MonForm>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-navy">{m.addSponsorship}</summary>
            <div className="mt-3">
              <MonForm action="sponsorship" submit={m.addSponsorship} ok={m.recorded} testId="sponsorship-form">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={label}>{m.sponsor}<input name="sponsor_name" required className={field} /></label>
                  <label className={label}>{m.contact}<input name="contact" className={field} /></label>
                  <label className={label}>{m.value}<input name="value" required inputMode="decimal" className={field} /></label>
                  <Currency name="currency" l={m.currency} />
                </div>
                <label className={label}>{m.deliverables}<textarea name="deliverables" required rows={2} className={field} /></label>
                {approvedVideos.length > 0 && (
                  <fieldset className="text-sm"><legend className="font-medium text-navy">{m.videos}</legend>
                    {approvedVideos.map((v) => <label key={v.id} className="mt-1 flex items-start gap-2" lang="yo"><input type="checkbox" name="render_ids" value={v.id} className="mt-1 accent-gold" />{v.title_yo || v.title_en}</label>)}
                  </fieldset>
                )}
              </MonForm>
            </div>
          </details>
        </Card>
      </div>
    </>
  );
}
