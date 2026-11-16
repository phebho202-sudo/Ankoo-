import type { RenderStatus } from "./api";

export function renderTone(s: RenderStatus): "green" | "gold" | "neutral" | "red" {
  if (s === "approved") return "green";
  if (s === "awaiting_approval") return "gold";
  if (s === "queued" || s === "rendering") return "neutral";
  return "red";
}

/** Whether the render page should keep refreshing. */
export function inProgress(s: RenderStatus): boolean {
  return s === "queued" || s === "rendering";
}
