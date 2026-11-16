import { proxyDownload } from "@/lib/proxy";

// Streams the signed licence through the dashboard so the session token never reaches the browser.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyDownload(req, `/api/v1/rights/licences/${encodeURIComponent(id)}/document`);
}
