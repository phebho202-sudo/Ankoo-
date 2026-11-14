"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getJobAction } from "@/app/content-actions";
import type { JobInfo } from "@/lib/api";

export type JobLabels = {
  queued: string;
  running: string;
  succeeded: string;
  failed: string;
  blocked: string;
  slow: string;
};

const POLL_MS = 1500;
const GIVE_UP_MS = 120_000;

/** Polls a background job and refreshes the page when it ends. Shows the real outcome. */
export function JobWatcher({ jobId, labels }: { jobId: string; labels: JobLabels }) {
  const router = useRouter();
  const [job, setJob] = useState<JobInfo | null>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let stopped = false;
    const started = Date.now();
    const tick = async () => {
      if (stopped) return;
      const j = await getJobAction(jobId);
      if (stopped) return;
      if (j) setJob(j);
      if (j && ["succeeded", "failed", "blocked"].includes(j.status)) {
        router.refresh();
        return;
      }
      if (Date.now() - started > GIVE_UP_MS) {
        setSlow(true);
        return;
      }
      setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      stopped = true;
    };
  }, [jobId, router]);

  const status = job?.status ?? "queued";
  const fill = (s: string) => s.replace("{msg}", job?.error ?? "");
  const tone =
    status === "succeeded"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : status === "failed" || status === "blocked"
        ? "border-red-300 bg-red-50 text-red-900"
        : "border-navy-100 bg-cream-50 text-charcoal";
  return (
    <p role="status" aria-live="polite" className={`rounded-md border px-3 py-2 text-sm ${tone}`}>
      {slow ? labels.slow : fill(labels[status])}
    </p>
  );
}
