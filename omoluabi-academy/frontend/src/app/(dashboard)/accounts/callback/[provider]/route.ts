import { NextResponse } from "next/server";
import { authedFetch } from "@/lib/session";

// The platform sends the owner back here after sign-in: /accounts/callback/{google|meta|tiktok}
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const back = new URL("/accounts", url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    back.searchParams.set("error", url.searchParams.get("error_description") || url.searchParams.get("error") || "cancelled");
    return NextResponse.redirect(back);
  }
  const r = await authedFetch<{ accounts: unknown[] }>(`/api/v1/accounts/callback/${encodeURIComponent(provider)}`, {
    method: "POST",
    body: JSON.stringify({ code, state }),
  });
  if (r.ok) back.searchParams.set("connected", String(r.data.accounts.length));
  else back.searchParams.set("error", r.error);
  return NextResponse.redirect(back);
}
