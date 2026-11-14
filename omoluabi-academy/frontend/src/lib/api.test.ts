import { describe, expect, it } from "vitest";
import { getReadiness } from "./api";

const jsonResponse = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("getReadiness", () => {
  it("returns data when the backend is healthy", async () => {
    const body = { status: "ok", checks: { database: { ok: true } }, provider_mode: "sample", environment: "test" };
    const r = await getReadiness(() => jsonResponse(200, body));
    expect(r).toEqual({ ok: true, data: body, httpStatus: 200 });
  });

  it("still returns the body when degraded (503)", async () => {
    const body = { status: "degraded", checks: { redis: { ok: false } }, provider_mode: "sample", environment: "test" };
    const r = await getReadiness(() => jsonResponse(503, body));
    expect(r.ok && r.data.status).toBe("degraded");
  });

  it("reports unreachable instead of throwing", async () => {
    const r = await getReadiness(() => Promise.reject(new TypeError("fetch failed")));
    expect(r).toEqual({ ok: false, error: "Backend unreachable" });
  });

  it("surfaces API error messages", async () => {
    const r = await getReadiness(() => jsonResponse(401, { error: { message: "token required" } }));
    expect(r).toEqual({ ok: false, error: "token required", httpStatus: 401 });
  });

  it("keeps the error code and details for callers to act on", async () => {
    const { fetchJson } = await import("./api");
    const r = await fetchJson("/api/v1/settings/x", undefined, () =>
      jsonResponse(422, { error: { message: "m", code: "blocked_by_policy", details: { requires: "confirm_increase" } } }),
    );
    expect(r).toEqual({
      ok: false,
      error: "m",
      code: "blocked_by_policy",
      details: { requires: "confirm_increase" },
      httpStatus: 422,
    });
  });

  it("does not treat a 503 from other endpoints as success", async () => {
    const { fetchJson } = await import("./api");
    const r = await fetchJson("/api/v1/overview", undefined, () => jsonResponse(503, { error: { message: "down" } }));
    expect(r.ok).toBe(false);
  });
});
