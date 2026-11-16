import { NextResponse } from "next/server";
import { fetchJson } from "@/lib/api";

// Public affiliate redirect: /go/<slug>?s=<source>. Counts the click (no personal data is
// stored) and sends the visitor to the partner. Unknown or paused links go to a plain 404.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const src = url.searchParams.get("s");
  const q = src ? `?s=${encodeURIComponent(src)}` : "";
  const referer = req.headers.get("referer");
  const r = await fetchJson<{ url: string }>(`/api/v1/public/go/${encodeURIComponent(slug)}${q}`, {
    headers: referer ? { Referer: referer } : {},
  });
  if (!r.ok || !/^https:\/\//.test(r.data.url)) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(r.data.url, 302);
}
