"use server";

import { revalidatePath } from "next/cache";
import { toMinor } from "@/lib/money";
import { authedFetch } from "@/lib/session";

export type MonResult = { status: "idle" } | { status: "ok"; checkoutUrl?: string | null; sample?: boolean } | { status: "error"; message: string };
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function post(path: string, body: unknown, method = "POST"): Promise<MonResult> {
  const r = await authedFetch<{ checkout_url?: string | null; is_sample?: boolean }>(path, { method, body: JSON.stringify(body) });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/monetisation");
  return { status: "ok", checkoutUrl: r.data.checkout_url, sample: r.data.is_sample };
}

function money(f: FormData, key: string): number | MonResult {
  const v = toMinor(s(f, key));
  return v === null ? { status: "error", message: "Enter an amount such as 2,500 or 2,500.50" } : v;
}

export async function linkAction(_p: MonResult, f: FormData): Promise<MonResult> {
  return post("/api/v1/affiliate-links", {
    slug: s(f, "slug"), name: s(f, "name"), partner: s(f, "partner"), destination_url: s(f, "destination_url"),
    disclosure_yo: s(f, "disclosure_yo"), disclosure_en: s(f, "disclosure_en"), commission_note: s(f, "commission_note") || null,
  });
}

export async function productAction(_p: MonResult, f: FormData): Promise<MonResult> {
  const price = money(f, "price");
  if (typeof price !== "number") return price;
  return post("/api/v1/products", {
    name_yo: s(f, "name_yo"), name_en: s(f, "name_en"), description: s(f, "description"), kind: s(f, "kind") || "other",
    price_minor: price, currency: s(f, "currency") || "NGN", status: s(f, "status") || "draft", delivery_note: s(f, "delivery_note") || null,
  });
}

export async function checkoutAction(_p: MonResult, f: FormData): Promise<MonResult> {
  return post(`/api/v1/products/${encodeURIComponent(s(f, "id"))}/checkout`, { email: s(f, "email") });
}

export async function sponsorshipAction(_p: MonResult, f: FormData): Promise<MonResult> {
  const value = money(f, "value");
  if (typeof value !== "number") return value;
  return post("/api/v1/sponsorships", {
    sponsor_name: s(f, "sponsor_name"), contact: s(f, "contact") || null, deliverables: s(f, "deliverables"),
    value_minor: value, currency: s(f, "currency") || "NGN", render_ids: f.getAll("render_ids").map(String),
  });
}

export async function sponsorshipStatusAction(_p: MonResult, f: FormData): Promise<MonResult> {
  return post(`/api/v1/sponsorships/${encodeURIComponent(s(f, "id"))}/status`, {
    status: s(f, "status"), contract_reference: s(f, "contract_reference") || null,
  });
}

export async function revenueAction(_p: MonResult, f: FormData): Promise<MonResult> {
  const amount = money(f, "amount");
  if (typeof amount !== "number") return amount;
  return post("/api/v1/revenue", {
    source: s(f, "source"), amount_minor: amount, currency: s(f, "currency"), occurred_on: s(f, "occurred_on"),
    description: s(f, "description"), reference: s(f, "reference") || null, link_id: s(f, "link_id") || null,
  });
}

export async function syncAnalyticsAction(_p: MonResult): Promise<MonResult> {
  const r = await authedFetch("/api/v1/analytics/sync", { method: "POST" });
  if (!r.ok) return { status: "error", message: r.error };
  return { status: "ok" };
}
