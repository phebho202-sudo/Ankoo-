"use client";

import { useActionState } from "react";
import { syncAnalyticsAction } from "@/app/monetisation-actions";
import { secondaryButtonClass } from "@/components/ui";

export function SyncButton({ text, ok }: { text: string; ok: string }) {
  const [state, run, pending] = useActionState(syncAnalyticsAction, { status: "idle" as const });
  return (
    <form action={run} className="inline-flex items-center gap-2">
      <button type="submit" disabled={pending} className={secondaryButtonClass}>{text}</button>
      {state.status === "ok" && <span role="status" className="text-sm text-emerald-800">✓ {ok}</span>}
      {state.status === "error" && <span role="alert" className="text-sm text-red-800">{state.message}</span>}
    </form>
  );
}
