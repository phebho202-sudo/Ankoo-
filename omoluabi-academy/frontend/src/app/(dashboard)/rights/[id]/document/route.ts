import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

// Streams the signed licence through the dashboard so the session token never reaches the browser.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.redirect(new URL("/login", _req.url));
  const r = await fetch(`${backendUrl()}/api/v1/rights/licences/${encodeURIComponent(id)}/document`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return new NextResponse("Document not available", { status: r.status });
  return new NextResponse(r.body, {
    headers: {
      "Content-Type": r.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": r.headers.get("content-disposition") ?? "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
