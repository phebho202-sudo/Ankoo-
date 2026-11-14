"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { fetchJson, type SettingKind, type User } from "@/lib/api";
import { isLocale, LANG_COOKIE } from "@/lib/i18n/format";
import { authedFetch, cookieSecure, getSessionToken, SESSION_COOKIE } from "@/lib/session";
import { classifySettingError, parseSettingInput, type SettingFormState } from "@/lib/settings";

export type LoginState = { error?: "invalid" | "locked" | "unreachable"; email?: string };

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const r = await fetchJson<{ token: string; expires_at: string; user: User }>("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) {
    // Return the email so the form keeps it (React resets forms after an action).
    if (r.httpStatus === undefined || r.httpStatus >= 500) return { error: "unreachable", email };
    return { error: r.details?.locked_until ? "locked" : "invalid", email };
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, r.data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    expires: new Date(r.data.expires_at),
  });
  jar.set(LANG_COOKIE, r.data.user.preferred_language, {
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const token = await getSessionToken();
  if (token) {
    await fetchJson("/api/v1/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function setLanguageAction(form: FormData): Promise<void> {
  const lang = form.get("lang");
  if (!isLocale(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, {
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  const token = await getSessionToken();
  if (token) {
    // Remember the choice on the owner's account too (best effort).
    await fetchJson("/api/v1/auth/me/language", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang }),
    });
  }
  revalidatePath("/", "layout");
}

export async function updateSettingAction(
  _prev: SettingFormState,
  form: FormData,
): Promise<SettingFormState> {
  const key = String(form.get("key") ?? "");
  const kind = String(form.get("kind") ?? "") as SettingKind;
  const value = parseSettingInput(kind, String(form.get("value") ?? ""));
  const confirm = form.get("confirm_increase") === "on";
  const r = await authedFetch(`/api/v1/settings/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ value, confirm_increase: confirm }),
  });
  if (!r.ok) return { status: "error", reason: classifySettingError(key, r), message: r.error };
  revalidatePath("/settings");
  revalidatePath("/");
  return { status: "saved" };
}
