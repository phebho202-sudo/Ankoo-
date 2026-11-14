// Client for the FastAPI backend, used from the Next.js server. It never throws: failures
// come back as { ok: false } so pages show an honest error state instead of crashing or
// showing invented data.

export type DependencyCheck = { ok: boolean; error?: string };

export type Readiness = {
  status: "ok" | "degraded";
  checks: Record<string, DependencyCheck>;
  provider_mode: "sample" | "live";
  environment: string;
};

export type ApiError = {
  ok: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  httpStatus?: number;
};

export type ApiResult<T> = { ok: true; data: T; httpStatus: number } | ApiError;

export function backendUrl(): string {
  return (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/+$/, "");
}

type ErrorBody = { error?: { message?: string; code?: string; details?: Record<string, unknown> } };

export async function fetchJson<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? 8000);
  try {
    const res = await fetchImpl(`${backendUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 204) return { ok: true, data: null as T, httpStatus: 204 };
    const body = (await res.json().catch(() => null)) as unknown;
    // /health/ready legitimately returns a JSON body with 503 when degraded.
    const isReadiness = path.startsWith("/health/ready") && res.status === 503;
    if (body !== null && (res.ok || isReadiness)) {
      return { ok: true, data: body as T, httpStatus: res.status };
    }
    const err = (body as ErrorBody | null)?.error;
    const out: ApiError = { ok: false, error: err?.message ?? `HTTP ${res.status}`, httpStatus: res.status };
    if (err?.code) out.code = err.code;
    if (err?.details) out.details = err.details;
    return out;
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

// ---- Response types
export type AuditEntry = {
  id: number;
  occurred_at: string;
  actor: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
};

export type ProviderStatus = {
  capability: string;
  provider: string;
  is_sample: boolean;
  configured: boolean;
  detail: string;
};

export type Overview = {
  provider_mode: "sample" | "live";
  environment: string;
  jobs: Record<string, number>;
  budget: {
    month_start: string;
    spent_usd: string;
    limit_usd: string;
    alert_threshold_percent: number;
    used_percent: number | null;
  };
  audit: { ok: boolean; entries: number };
  recent_activity: AuditEntry[];
  providers: ProviderStatus[];
  setup_checklist: { key: string; done: boolean }[];
};

export type SettingKind = "decimal" | "int" | "bool" | "choice";

export type SettingItem = {
  key: string;
  category: string;
  kind: SettingKind;
  value: string | number | boolean;
  default: string | number | boolean;
  is_default: boolean;
  description: string;
  minimum: string | null;
  maximum: string | null;
  choices: string[];
  unit: string | null;
  spending_limit: boolean;
  updated_by: string | null;
  updated_at: string | null;
};

export type User = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  preferred_language: "en" | "yo";
};
