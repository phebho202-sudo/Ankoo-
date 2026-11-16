import type { PublicationStatus } from "./api";

export const UPCOMING: PublicationStatus[] = ["scheduled", "uploading", "retrying"];

export function publicationTone(s: PublicationStatus): "green" | "gold" | "neutral" | "red" {
  if (s === "uploaded") return "green";
  if (s === "unconfirmed" || s === "simulated" || s === "retrying") return "gold";
  if (s === "scheduled" || s === "uploading" || s === "cancelled") return "neutral";
  return "red";
}

/** "2026-11-20T18:00" typed in Lagos time -> ISO with the WAT offset (no daylight saving). */
export function lagosLocalToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  return `${value}:00+01:00`;
}

export const OAUTH_KEYS: Record<string, string> = {
  google: "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET",
  meta: "META_APP_ID, META_APP_SECRET",
  tiktok: "TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET",
};

export const PROVIDER_PLATFORMS: Record<string, string[]> = {
  google: ["youtube"],
  meta: ["facebook", "instagram"],
  tiktok: ["tiktok"],
};
