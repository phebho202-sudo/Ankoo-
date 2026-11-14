// Pure helpers for the settings form (unit-tested; no Next.js imports).
import type { ApiError, SettingKind } from "./api";

/** Convert a raw form value into the JSON value the backend expects. */
export function parseSettingInput(kind: SettingKind, raw: string): string | number | boolean {
  const value = raw.trim();
  if (kind === "bool") return value === "true";
  if (kind === "int") {
    // Send non-numeric text as-is so the backend rejects it with a clear message.
    return /^-?\d+$/.test(value) ? Number(value) : value;
  }
  return value; // decimals stay strings to avoid floating-point rounding
}

export type SettingErrorReason = "needs_confirmation" | "auto_publish_blocked" | "invalid" | "failed";

export function classifySettingError(key: string, err: ApiError): SettingErrorReason {
  if (err.code === "blocked_by_policy") {
    if (err.details?.requires === "confirm_increase") return "needs_confirmation";
    if (key === "publishing.auto_publish_enabled") return "auto_publish_blocked";
    return "failed";
  }
  if (err.code === "app_error" || err.code === "validation_error") return "invalid";
  return "failed";
}

export type SettingFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; reason: SettingErrorReason; message: string };
