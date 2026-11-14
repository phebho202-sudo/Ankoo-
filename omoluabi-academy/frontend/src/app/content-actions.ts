"use server";

import { revalidatePath } from "next/cache";
import type { JobInfo } from "@/lib/api";
import { authedFetch } from "@/lib/session";

export type ActionState =
  | { status: "idle" }
  | { status: "ok"; jobId?: string; message?: string }
  | { status: "error"; message: string };

const s = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function addChannelAction(_p: ActionState, form: FormData): Promise<ActionState> {
  const r = await authedFetch("/api/v1/channels", {
    method: "POST",
    body: JSON.stringify({
      reference: s(form, "reference"),
      authorisation_basis: s(form, "basis"),
      authorisation_note: s(form, "note"),
    }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/episodes");
  return { status: "ok" };
}

export async function scanChannelAction(_p: ActionState, form: FormData): Promise<ActionState> {
  const r = await authedFetch<{ job_id: string }>(
    `/api/v1/channels/${encodeURIComponent(s(form, "channel_id"))}/scan`,
    { method: "POST" },
  );
  if (!r.ok) return { status: "error", message: r.error };
  return { status: "ok", jobId: r.data.job_id };
}

export async function setChannelActiveAction(form: FormData): Promise<void> {
  await authedFetch(`/api/v1/channels/${encodeURIComponent(s(form, "channel_id"))}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: s(form, "active") === "true" }),
  });
  revalidatePath("/episodes");
}

export async function saveTranscriptAction(_p: ActionState, form: FormData): Promise<ActionState> {
  const id = s(form, "episode_id");
  const r = await authedFetch(`/api/v1/episodes/${encodeURIComponent(id)}/transcript`, {
    method: "PUT",
    body: JSON.stringify({
      text: String(form.get("text") ?? ""),
      language: s(form, "language") || "en",
      source: s(form, "source"),
      permission_reference: s(form, "permission_reference"),
    }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath(`/episodes/${id}`);
  return { status: "ok" };
}

export async function requestResearchAction(_p: ActionState, form: FormData): Promise<ActionState> {
  const episodeId = s(form, "episode_id");
  const body = episodeId ? { episode_id: episodeId } : { subject: s(form, "subject") };
  const r = await authedFetch<{ report_id: string; job_id: string }>("/api/v1/research", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!r.ok) return { status: "error", message: r.error };
  return { status: "ok", jobId: r.data.job_id };
}

export async function decideTopicAction(_p: ActionState, form: FormData): Promise<ActionState> {
  const r = await authedFetch(`/api/v1/topics/${encodeURIComponent(s(form, "topic_id"))}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision: s(form, "decision"), note: s(form, "note") || null }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/research", "layout");
  return { status: "ok" };
}

/** Polled by <JobWatcher>. Returns null when the job cannot be read. */
export async function getJobAction(jobId: string): Promise<JobInfo | null> {
  const r = await authedFetch<JobInfo>(`/api/v1/system/jobs/${encodeURIComponent(jobId)}`);
  return r.ok ? r.data : null;
}
