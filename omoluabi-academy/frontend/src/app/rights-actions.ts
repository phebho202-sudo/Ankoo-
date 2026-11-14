"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LicenceDetail, OriginalityResult, Reason, RightsDecision } from "@/lib/api";
import { authedFetch } from "@/lib/session";

export type FormResult = { status: "idle" } | { status: "ok" } | { status: "error"; message: string; problems?: string[] };

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function licenceBody(f: FormData) {
  const date = (k: string) => (s(f, k) ? `${s(f, k)}T00:00:00` : null); // Lagos midnight (backend)
  return {
    licence_reference: s(f, "licence_reference"),
    licensor_name: s(f, "licensor_name"),
    licensor_contact: s(f, "licensor_contact") || null,
    description: s(f, "description") || null,
    signed_on: date("signed_on"),
    effective_from: date("effective_from"),
    expires_at: date("expires_at"),
    translation: s(f, "translation") || "unclear",
    adaptation: s(f, "adaptation") || "unclear",
    commercial: s(f, "commercial") || "unclear",
    distribution: s(f, "distribution") || "unclear",
    permitted_platforms: f.getAll("permitted_platforms").map(String),
    permitted_languages: s(f, "permitted_languages").split(",").map((x) => x.trim()).filter(Boolean),
    territory: s(f, "territory") || null,
    attribution_required: f.get("attribution_required") === "on",
    attribution_text: s(f, "attribution_text") || null,
  };
}

export async function saveLicenceAction(_p: FormResult, f: FormData): Promise<FormResult> {
  const id = s(f, "id");
  const r = await authedFetch<LicenceDetail>(id ? `/api/v1/rights/licences/${encodeURIComponent(id)}` : "/api/v1/rights/licences", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(licenceBody(f)),
  });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/rights", "layout");
  if (!id) redirect(`/rights/${r.data.id}`);
  return { status: "ok" };
}

export async function uploadDocumentAction(_p: FormResult, f: FormData): Promise<FormResult> {
  const id = s(f, "id");
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose a file" };
  const body = new FormData();
  body.append("file", file, file.name);
  const r = await authedFetch(`/api/v1/rights/licences/${encodeURIComponent(id)}/document`, { method: "POST", body });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath(`/rights/${id}`);
  return { status: "ok" };
}

export async function setScopeAction(_p: FormResult, f: FormData): Promise<FormResult> {
  const id = s(f, "id");
  const r = await authedFetch(`/api/v1/rights/licences/${encodeURIComponent(id)}/scope`, {
    method: "PUT",
    body: JSON.stringify({ channel_id: s(f, "channel_id") || null, episode_ids: f.getAll("episode_ids").map(String) }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath(`/rights/${id}`);
  return { status: "ok" };
}

export async function verifyLicenceAction(_p: FormResult, f: FormData): Promise<FormResult> {
  const id = s(f, "id");
  const r = await authedFetch(`/api/v1/rights/licences/${encodeURIComponent(id)}/verify`, {
    method: "POST",
    body: JSON.stringify({ confirmed: f.get("confirmed") === "on" }),
  });
  if (!r.ok) return { status: "error", message: r.error, problems: (r.details?.problems as string[]) ?? undefined };
  revalidatePath("/rights", "layout");
  return { status: "ok" };
}

export async function revokeLicenceAction(_p: FormResult, f: FormData): Promise<FormResult> {
  const id = s(f, "id");
  const r = await authedFetch(`/api/v1/rights/licences/${encodeURIComponent(id)}/revoke`, {
    method: "POST",
    body: JSON.stringify({ reason: s(f, "reason") }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/rights", "layout");
  return { status: "ok" };
}

export type CheckResult = { status: "idle" } | { status: "done"; decision: RightsDecision; licenceRef: string | null } | { status: "error"; message: string };

export async function checkRightsAction(_p: CheckResult, f: FormData): Promise<CheckResult> {
  const purpose = s(f, "purpose");
  const r = await authedFetch<RightsDecision>("/api/v1/rights/check", {
    method: "POST",
    body: JSON.stringify({ episode_id: s(f, "episode_id"), purpose, platform: purpose === "publish" ? s(f, "platform") || null : null }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  let licenceRef: string | null = null;
  if (r.data.licence_id) {
    const l = await authedFetch<LicenceDetail>(`/api/v1/rights/licences/${r.data.licence_id}`);
    licenceRef = l.ok ? l.data.licence_reference : null;
  }
  revalidatePath("/episodes", "layout");
  return { status: "done", decision: r.data, licenceRef };
}

export type OriginalityState = { status: "idle" } | { status: "done"; result: OriginalityResult } | { status: "error"; message: string };

export async function originalityAction(_p: OriginalityState, f: FormData): Promise<OriginalityState> {
  const r = await authedFetch<OriginalityResult>("/api/v1/rights/originality", {
    method: "POST",
    body: JSON.stringify({ text: String(f.get("text") ?? "") }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  return { status: "done", result: r.data };
}

export async function setChannelBasisAction(_p: FormResult, f: FormData): Promise<FormResult> {
  const r = await authedFetch(`/api/v1/channels/${encodeURIComponent(s(f, "channel_id"))}`, {
    method: "PATCH",
    body: JSON.stringify({ authorisation_basis: s(f, "basis"), authorisation_note: s(f, "note") }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/episodes");
  return { status: "ok" };
}

export type { Reason };
