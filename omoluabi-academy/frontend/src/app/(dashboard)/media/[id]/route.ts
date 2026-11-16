import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

// Streams audio/video/images through the dashboard (the session token never reaches the
// browser) and passes Range requests through, so players can seek.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return new NextResponse("Login required", { status: 401 });
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const range = req.headers.get("range");
  if (range) headers.Range = range;
  const r = await fetch(`${backendUrl()}/api/v1/media/${encodeURIComponent(id)}`, { headers, cache: "no-store" });
  if (!r.ok && r.status !== 206) return new NextResponse("Media not available", { status: r.status });
  const out = new Headers({ "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" });
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = r.headers.get(h);
    if (v) out.set(h, v);
  }
  return new NextResponse(r.body, { status: r.status, headers: out });
}
