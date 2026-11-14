// Turns rights-check reasons from the API into sentences in the current language.
import type { Reason } from "./api";
import type { Dictionary } from "./i18n/dictionaries";

type RightsText = Dictionary["rights"];

export function describeReason(reason: Reason, t: RightsText): string {
  const template = (t.reasons as Record<string, string>)[reason.code];
  if (!template) return reason.code; // unknown code: show it rather than hide it
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(reason)) vars[k] = String(v ?? "");
  if (typeof reason.right === "string") vars.right = (t.rightNames as Record<string, string>)[reason.right] ?? reason.right;
  if (typeof reason.state === "string") vars.state = (t.grant as Record<string, string>)[reason.state] ?? reason.state;
  if (typeof reason.platform === "string") vars.platform = (t.platformNames as Record<string, string>)[reason.platform] ?? reason.platform;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

export function describeProblem(code: string, t: RightsText): string {
  return (t.problems as Record<string, string>)[code] ?? code;
}

/** Date input value (YYYY-MM-DD) for an ISO timestamp, in Lagos time. */
export function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date(iso));
}
