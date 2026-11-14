import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchJson, type ApiResult } from "./api";

export const SESSION_COOKIE = "omoluabi_session";

export function cookieSecure(): boolean {
  // Secure cookies in production; COOKIE_SECURE=false allows a local http production build.
  return process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";
}

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Call the backend as the logged-in owner. Redirects to the login page when the session is gone. */
export async function authedFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const result = await fetchJson<T>(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!result.ok && result.httpStatus === 401) redirect("/login?expired=1");
  return result;
}
