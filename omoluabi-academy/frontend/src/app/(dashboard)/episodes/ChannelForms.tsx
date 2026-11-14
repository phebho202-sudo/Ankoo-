"use client";

import { useActionState, useState } from "react";
import { addChannelAction, scanChannelAction, type ActionState } from "@/app/content-actions";
import { JobWatcher, type JobLabels } from "@/components/JobWatcher";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

export type AddChannelLabels = {
  reference: string;
  referenceHelp: string;
  basis: string;
  basisResearch: string;
  basisResearchHelp: string;
  basisLicensed: string;
  basisLicensedHelp: string;
  note: string;
  noteHelp: string;
  add: string;
  adding: string;
  added: string;
  failed: string;
};

export function AddChannelForm({ labels }: { labels: AddChannelLabels }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addChannelAction, { status: "idle" });
  const [basis, setBasis] = useState("research_only");
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <label className="block text-sm font-medium text-navy">
        {labels.reference}
        <input name="reference" required className={`mt-1 ${inputClass}`} placeholder="youtube.com/@…" />
        <span className="mt-1 block text-xs font-normal text-charcoal-400">{labels.referenceHelp}</span>
      </label>
      <fieldset className="text-sm">
        <legend className="font-medium text-navy">{labels.basis}</legend>
        {(
          [
            ["research_only", labels.basisResearch, labels.basisResearchHelp],
            ["licensed", labels.basisLicensed, labels.basisLicensedHelp],
          ] as const
        ).map(([value, title, help]) => (
          <label key={value} className="mt-2 flex items-start gap-2">
            <input
              type="radio"
              name="basis"
              value={value}
              checked={basis === value}
              onChange={() => setBasis(value)}
              className="mt-1 accent-gold"
            />
            <span>
              <span className="font-medium">{title}</span>
              <span className="block text-xs text-charcoal-400">{help}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="block text-sm font-medium text-navy md:col-span-2">
        {labels.note}
        <textarea name="note" required minLength={15} rows={2} className={`mt-1 ${inputClass}`} />
        <span className="mt-1 block text-xs font-normal text-charcoal-400">{labels.noteHelp}</span>
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? labels.adding : labels.add}
        </button>
        {state.status === "ok" && !pending && <span role="status" className="text-sm text-emerald-800">✓ {labels.added}</span>}
        {state.status === "error" && !pending && (
          <span role="alert" className="text-sm text-red-800">
            {labels.failed.replace("{msg}", state.message)}
          </span>
        )}
      </div>
    </form>
  );
}

export function ScanButton({
  channelId,
  disabled,
  label,
  jobLabels,
}: {
  channelId: string;
  disabled: boolean;
  label: string;
  jobLabels: JobLabels;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(scanChannelAction, { status: "idle" });
  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="channel_id" value={channelId} />
        <button type="submit" disabled={disabled || pending} className={secondaryButtonClass}>
          {label}
        </button>
      </form>
      {state.status === "ok" && state.jobId && <JobWatcher key={state.jobId} jobId={state.jobId} labels={jobLabels} />}
      {state.status === "error" && <p role="alert" className="text-xs text-red-800">{state.message}</p>}
    </div>
  );
}
