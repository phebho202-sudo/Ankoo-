import { proxyDownload } from "@/lib/proxy";

// /scripts/{id}/download?type=srt-yo|srt-en|text&revision=N
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "srt-yo";
  const rev = url.searchParams.get("revision");
  const q = rev && /^\d+$/.test(rev) ? `revision=${rev}` : "";
  const base = `/api/v1/scripts/${encodeURIComponent(id)}`;
  const path =
    type === "text" ? `${base}/text?${q}` : `${base}/subtitles?lang=${type === "srt-en" ? "en" : "yo"}&${q}`;
  return proxyDownload(req, path);
}
