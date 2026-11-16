import { proxyDownload } from "@/lib/proxy";

export async function GET(req: Request) {
  return proxyDownload(req, "/api/v1/voice/presenter/portrait");
}
