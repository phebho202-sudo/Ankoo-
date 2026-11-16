"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { lagosLocalToIso } from "@/lib/publishing";
import { authedFetch } from "@/lib/session";

export type PubResult = { status: "idle" } | { status: "ok" } | { status: "error"; message: string };
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function connectAction(_p: PubResult, f: FormData): Promise<PubResult> {
  const r = await authedFetch<{ auth_url: string }>(`/api/v1/accounts/connect/${encodeURIComponent(s(f, "provider"))}`, { method: "POST" });
  if (!r.ok) return { status: "error", message: r.error };
  redirect(r.data.auth_url);
}

export async function connectSampleAction(_p: PubResult, f: FormData): Promise<PubResult> {
  const r = await authedFetch(`/api/v1/accounts/sample/${encodeURIComponent(s(f, "platform"))}`, { method: "POST" });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/accounts");
  return { status: "ok" };
}

export async function disconnectAction(_p: PubResult, f: FormData): Promise<PubResult> {
  const r = await authedFetch(`/api/v1/accounts/${encodeURIComponent(s(f, "id"))}/disconnect`, { method: "POST" });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/accounts");
  return { status: "ok" };
}

export async function scheduleAction(_p: PubResult, f: FormData): Promise<PubResult> {
  const when = s(f, "when");
  const iso = when ? lagosLocalToIso(when) : null;
  if (when && !iso) return { status: "error", message: "Invalid date" };
  const r = await authedFetch("/api/v1/publications", {
    method: "POST",
    body: JSON.stringify({
      render_id: s(f, "render_id"),
      destination: s(f, "destination"),
      account_id: s(f, "account_id"),
      visibility: s(f, "visibility") || null,
      scheduled_at: iso,
      title: s(f, "title") || null,
      description: s(f, "description") || null,
    }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/calendar");
  return { status: "ok" };
}

async function simple(path: string): Promise<PubResult> {
  const r = await authedFetch(path, { method: "POST" });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/calendar");
  return { status: "ok" };
}

export async function cancelAction(_p: PubResult, f: FormData): Promise<PubResult> {
  const res = await simple(`/api/v1/publications/${encodeURIComponent(s(f, "id"))}/cancel`);
  revalidatePath(`/calendar/${s(f, "id")}`);
  return res;
}

export async function pauseAction(_p: PubResult, f: FormData): Promise<PubResult> {
  return simple(f.get("resume") ? "/api/v1/publishing/resume" : "/api/v1/publishing/pause");
}

export async function runNowAction(_p: PubResult): Promise<PubResult> {
  return simple("/api/v1/publishing/run");
}

export async function resolveAction(_p: PubResult, f: FormData): Promise<PubResult> {
  const id = s(f, "id");
  const r = await authedFetch(`/api/v1/publications/${encodeURIComponent(id)}/resolve`, {
    method: "POST",
    body: JSON.stringify({ on_platform: s(f, "found") === "yes", url: s(f, "url") || null }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath(`/calendar/${id}`);
  return { status: "ok" };
}
