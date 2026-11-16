"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authedFetch } from "@/lib/session";

export type VResult = { status: "idle" } | { status: "ok"; jobId?: string } | { status: "error"; message: string; problems?: string[] };
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => {
  const v = s(f, k);
  return v === "" ? undefined : Math.min(1, Math.max(0, Number(v)));
};

export async function savePresenterAction(_p: VResult, f: FormData): Promise<VResult> {
  const settings: Record<string, number> = {};
  const st = num(f, "stability");
  const sim = num(f, "similarity_boost");
  if (st !== undefined && !Number.isNaN(st)) settings.stability = st;
  if (sim !== undefined && !Number.isNaN(sim)) settings.similarity_boost = sim;
  const r = await authedFetch("/api/v1/voice/presenter", {
    method: "PUT",
    body: JSON.stringify({
      name: s(f, "name"),
      description: s(f, "description"),
      voice_id: s(f, "voice_id"),
      voice_model: s(f, "voice_model"),
      voice_settings: settings,
      voice_is_original_or_licensed: f.get("decl_voice") === "on",
      portrait_is_original_or_licensed: f.get("decl_portrait") === "on",
      not_a_real_person: f.get("decl_person") === "on",
    }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/voice");
  return { status: "ok" };
}

export async function uploadPortraitAction(_p: VResult, f: FormData): Promise<VResult> {
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose an image" };
  const body = new FormData();
  body.append("file", file, file.name);
  const r = await authedFetch("/api/v1/voice/presenter/portrait", { method: "POST", body });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/voice");
  return { status: "ok" };
}

export async function approvePresenterAction(_p: VResult): Promise<VResult> {
  const r = await authedFetch("/api/v1/voice/presenter/approve", { method: "POST" });
  if (!r.ok) return { status: "error", message: r.error, problems: (r.details?.problems as string[]) ?? undefined };
  revalidatePath("/voice");
  return { status: "ok" };
}

export async function requestTestAction(_p: VResult): Promise<VResult> {
  const r = await authedFetch<{ job_id: string }>("/api/v1/voice/tests", { method: "POST" });
  if (!r.ok) return { status: "error", message: r.error };
  return { status: "ok", jobId: r.data.job_id };
}

export async function rateTestAction(_p: VResult, f: FormData): Promise<VResult> {
  const ratings = Object.fromEntries(f.getAll("ok").map((k) => [String(k), true]));
  const r = await authedFetch(`/api/v1/voice/tests/${encodeURIComponent(s(f, "id"))}/rating`, {
    method: "POST",
    body: JSON.stringify({ ratings, notes: s(f, "notes") || null }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/voice");
  return { status: "ok" };
}

export async function requestRunAction(_p: VResult, f: FormData): Promise<VResult> {
  const r = await authedFetch<{ run_id: string }>("/api/v1/voice/runs", {
    method: "POST",
    body: JSON.stringify({ script_id: s(f, "script_id"), video_format: "hybrid" }),
  });
  if (!r.ok) return { status: "error", message: r.error };
  redirect(`/voice/runs/${r.data.run_id}`);
}
