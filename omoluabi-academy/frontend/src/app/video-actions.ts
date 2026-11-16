"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authedFetch } from "@/lib/session";

export type VidResult = { status: "idle" } | { status: "ok" } | { status: "error"; message: string; failed?: string[]; missing?: string[] };
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function requestRenderAction(_p: VidResult, f: FormData): Promise<VidResult> {
  const r = await authedFetch<{ render_id: string }>("/api/v1/videos", {
    method: "POST",
    body: JSON.stringify({ run_id: s(f, "run_id") }),
  });
  if (!r.ok) return { status: "error", message: r.error, failed: (r.details?.failed as string[]) ?? undefined };
  redirect(`/video/${r.data.render_id}`);
}

export async function decideVideoAction(_p: VidResult, f: FormData): Promise<VidResult> {
  const id = s(f, "id");
  const checklist = Object.fromEntries(f.getAll("ok").map((k) => [String(k), true]));
  const r = await authedFetch(`/api/v1/videos/${encodeURIComponent(id)}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision: s(f, "decision"), checklist, notes: s(f, "notes") || null }),
  });
  if (!r.ok) return { status: "error", message: r.error, missing: (r.details?.missing as string[]) ?? undefined, failed: (r.details?.failed as string[]) ?? undefined };
  revalidatePath(`/video/${id}`);
  revalidatePath("/video");
  return { status: "ok" };
}
