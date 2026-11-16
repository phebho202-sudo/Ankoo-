import "server-only";
import { NextResponse } from "next/server";
import { backendUrl } from "./api";
import { getSessionToken } from "./session";

/** Stream a backend file through the dashboard so the session token never reaches the browser. */
export async function proxyDownload(req: Request, apiPath: string): Promise<Response> {
  const token = await getSessionToken();
  if (!token) return NextResponse.redirect(new URL("/login", req.url));
  const r = await fetch(`${backendUrl()}${apiPath}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!r.ok) return new NextResponse("File not available", { status: r.status });
  return new NextResponse(r.body, {
    headers: {
      "Content-Type": r.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": r.headers.get("content-disposition") ?? "attachment",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
