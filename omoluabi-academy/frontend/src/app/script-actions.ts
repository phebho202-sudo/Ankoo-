"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ScriptStatus, Segment } from "@/lib/api";
import { authedFetch } from "@/lib/session";

export type Result = { status: "idle" } | { status: "ok"; message?: string; jobId?: string } | { status: "error"; message: string };
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function createScriptAction(_p: Result, f: FormData): Promise<Result> {
  const kind = s(f, "kind");
  const r = await authedFetch<{ script_id: string; job_id: string }>("/api/v1/scripts", {
    method: "POST",
    body: JSON.stringify({
      kind,
      topic_id: kind === "original_lesson" ? s(f, "topic_id") : null,
      episode_id: kind === "licensed_adaptation" ? s(f, "episode_id") : null,
      format: s(f, "format") || "long_form",
      target_minutes: Number(s(f, "target_minutes") || 8),
    }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  redirect(`/scripts/${r.data.script_id}`);
}

export async function saveRevisionAction(id: string, title_yo: string, segments: Segment[], change_note: string): Promise<Result> {
  const r = await authedFetch(`/api/v1/scripts/${encodeURIComponent(id)}/revisions`, {
    method: "POST",
    body: JSON.stringify({ title_yo, segments, change_note }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath(`/scripts/${id}`);
  return { status: "ok" };
}

export async function submitScriptAction(_p: Result, f: FormData): Promise<Result> {
  const id = s(f, "id");
  const r = await authedFetch(`/api/v1/scripts/${encodeURIComponent(id)}/submit`, { method: "POST" });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath(`/scripts/${id}`);
  return { status: "ok" };
}

export async function reviewScriptAction(_p: Result, f: FormData): Promise<Result> {
  const id = s(f, "id");
  const checklist = Object.fromEntries(f.getAll("checklist").map((k) => [String(k), true]));
  const r = await authedFetch(`/api/v1/scripts/${encodeURIComponent(id)}/reviews`, {
    method: "POST",
    body: JSON.stringify({ decision: s(f, "decision"), checklist, comments: s(f, "comments") || null }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath(`/scripts/${id}`);
  return { status: "ok" };
}

export async function reviseScriptAction(_p: Result, f: FormData): Promise<Result> {
  const id = s(f, "id");
  const r = await authedFetch<{ job_id: string }>(`/api/v1/scripts/${encodeURIComponent(id)}/revise`, {
    method: "POST",
    body: JSON.stringify({ instructions: s(f, "instructions") }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  return { status: "ok", jobId: r.data.job_id };
}

export async function scriptStatusAction(id: string): Promise<{ status: ScriptStatus; revision: number } | null> {
  const r = await authedFetch<{ status: ScriptStatus; current_revision: number }>(`/api/v1/scripts/${encodeURIComponent(id)}`);
  return r.ok ? { status: r.data.status, revision: r.data.current_revision } : null;
}

// ---- glossary & pronunciation
export async function addTermAction(_p: Result, f: FormData): Promise<Result> {
  const r = await authedFetch("/api/v1/glossary", {
    method: "POST",
    body: JSON.stringify({ english: s(f, "english"), yoruba: s(f, "yoruba"), notes: s(f, "notes") || null }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/scripts/dictionary");
  return { status: "ok" };
}

export async function addPronAction(_p: Result, f: FormData): Promise<Result> {
  const r = await authedFetch("/api/v1/pronunciations", {
    method: "POST",
    body: JSON.stringify({ written: s(f, "written"), spoken: s(f, "spoken"), category: s(f, "category") || "term", notes: s(f, "notes") || null }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/scripts/dictionary");
  return { status: "ok" };
}

export async function entryAction(f: FormData): Promise<void> {
  const kind = s(f, "kind") === "glossary" ? "glossary" : "pronunciations";
  const id = encodeURIComponent(s(f, "id"));
  if (s(f, "op") === "approve") await authedFetch(`/api/v1/${kind}/${id}/approve`, { method: "POST" });
  if (s(f, "op") === "delete") await authedFetch(`/api/v1/${kind}/${id}`, { method: "DELETE" });
  revalidatePath("/scripts/dictionary");
}

// ---- account & team
export async function changePasswordAction(_p: Result, f: FormData): Promise<Result> {
  const r = await authedFetch("/api/v1/auth/me/password", {
    method: "PUT",
    body: JSON.stringify({ current_password: String(f.get("current") ?? ""), new_password: String(f.get("next") ?? "") }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  return { status: "ok" };
}

export async function addReviewerAction(_p: Result, f: FormData): Promise<Result> {
  const r = await authedFetch<{ email: string; temporary_password: string }>("/api/v1/users", {
    method: "POST",
    body: JSON.stringify({ email: s(f, "email"), display_name: s(f, "display_name") }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/settings");
  return { status: "ok", message: `${r.data.email}\n${r.data.temporary_password}` };
}

export async function setUserActiveAction(f: FormData): Promise<void> {
  await authedFetch(`/api/v1/users/${encodeURIComponent(s(f, "id"))}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: s(f, "active") === "true" }),
  });
  revalidatePath("/settings");
}
