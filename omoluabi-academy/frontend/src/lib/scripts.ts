import type { Issue, ScriptStatus } from "./api";
import type { Dictionary } from "./i18n/dictionaries";

/** Quality-check issue -> sentence in the current language (unknown codes shown as-is). */
export function describeIssue(issue: Issue, t: Dictionary["scripts"]): string {
  const template = (t.issues as Record<string, string>)[issue.code];
  if (!template) return issue.code;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = issue[k];
    if (v === undefined || v === null) return m;
    return Array.isArray(v) ? v.join(", ") : String(v);
  });
}

export function minutesSeconds(total: number): { min: number; sec: number } {
  const s = Math.round(total);
  return { min: Math.floor(s / 60), sec: s % 60 };
}

export function statusTone(s: ScriptStatus): "green" | "gold" | "red" | "neutral" | "navy" {
  if (s === "approved") return "green";
  if (s === "in_review") return "navy";
  if (s === "changes_requested") return "gold";
  if (s === "blocked") return "red";
  return "neutral";
}
