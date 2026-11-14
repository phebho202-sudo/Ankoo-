// Server-side client for the FastAPI backend. It never throws: failures come back as
// { ok: false } so the dashboard shows an honest "unreachable" state instead of crashing
// or showing invented data.

export type DependencyCheck = { ok: boolean; error?: string };

export type Readiness = {
  status: "ok" | "degraded";
  checks: Record<string, DependencyCheck>;
  provider_mode: "sample" | "live";
  environment: string;
};

export type ApiResult<T> =
  | { ok: true; data: T; httpStatus: number }
  | { ok: false; error: string; httpStatus?: number };

export function backendUrl(): string {
  return (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/+$/, "");
}

export async function fetchJson<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? 5000);
  try {
    const res = await fetchImpl(`${backendUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as unknown;
    // /health/ready legitimately returns a JSON body with 503 when degraded.
    if (body && (res.ok || res.status === 503)) {
      return { ok: true, data: body as T, httpStatus: res.status };
    }
    const message =
      (body as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    return { ok: false, error: message, httpStatus: res.status };
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError" ? "timed out" : "unreachable";
    return { ok: false, error: `Backend ${reason}` };
  } finally {
    clearTimeout(timer);
  }
}

export function getReadiness(fetchImpl?: typeof fetch) {
  return fetchJson<Readiness>("/health/ready", undefined, fetchImpl);
}
