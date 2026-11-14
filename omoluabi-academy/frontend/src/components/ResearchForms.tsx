"use client";

import { useActionState } from "react";
import {
  decideTopicAction,
  requestResearchAction,
  saveTranscriptAction,
  type ActionState,
} from "@/app/content-actions";
import { JobWatcher, type JobLabels } from "@/components/JobWatcher";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

const idle: ActionState = { status: "idle" };

function ErrorLine({ state, template }: { state: ActionState; template?: string }) {
  if (state.status !== "error") return null;
  return (
    <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {template ? template.replace("{msg}", state.message) : state.message}
    </p>
  );
}

export function ResearchRequestForm({
  episodeId,
  labels,
  jobLabels,
}: {
  episodeId?: string;
  labels: { start: string; subject?: string; subjectHelp?: string };
  jobLabels: JobLabels;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestResearchAction, idle);
  return (
    <form action={action} className="space-y-3">
      {episodeId ? (
        <input type="hidden" name="episode_id" value={episodeId} />
      ) : (
        <label className="block text-sm font-medium text-navy">
          {labels.subject}
          <input name="subject" required minLength={5} maxLength={300} className={`mt-1 ${inputClass}`} />
          <span className="mt-1 block text-xs font-normal text-charcoal-400">{labels.subjectHelp}</span>
        </label>
      )}
      <button type="submit" disabled={pending} className={buttonClass}>
        {labels.start}
      </button>
      {state.status === "ok" && state.jobId && <JobWatcher key={state.jobId} jobId={state.jobId} labels={jobLabels} />}
      <ErrorLine state={state} />
    </form>
  );
}

export type TranscriptLabels = {
  text: string;
  language: string;
  source: string;
  sources: Record<string, string>;
  permissionRef: string;
  permissionHelp: string;
  saveTranscript: string;
  transcriptSaved: string;
  english: string;
  yoruba: string;
};

export function TranscriptForm({ episodeId, labels }: { episodeId: string; labels: TranscriptLabels }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveTranscriptAction, idle);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="episode_id" value={episodeId} />
      <label className="block text-sm font-medium text-navy">
        {labels.text}
        <textarea name="text" required rows={6} className={`mt-1 ${inputClass}`} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-navy">
          {labels.source}
          <select name="source" required defaultValue="" className={`mt-1 ${inputClass}`}>
            <option value="" disabled>
              —
            </option>
            {Object.entries(labels.sources).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-navy">
          {labels.language}
          <select name="language" defaultValue="en" className={`mt-1 ${inputClass}`}>
            <option value="en">{labels.english}</option>
            <option value="yo">{labels.yoruba}</option>
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium text-navy">
        {labels.permissionRef}
        <input name="permission_reference" required minLength={10} className={`mt-1 ${inputClass}`} />
        <span className="mt-1 block text-xs font-normal text-charcoal-400">{labels.permissionHelp}</span>
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {labels.saveTranscript}
        </button>
        {state.status === "ok" && !pending && <span role="status" className="text-sm text-emerald-800">✓ {labels.transcriptSaved}</span>}
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

export function TopicDecisionForm({
  topicId,
  labels,
}: {
  topicId: string;
  labels: { approve: string; reject: string; decisionNote: string; decisionFailed: string };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(decideTopicAction, idle);
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="topic_id" value={topicId} />
      <div className="flex flex-wrap items-center gap-2">
        <input name="note" placeholder={labels.decisionNote} aria-label={labels.decisionNote} maxLength={2000} className={`${inputClass} max-w-sm flex-1`} />
        <button type="submit" name="decision" value="approved" disabled={pending} className={buttonClass}>
          {labels.approve}
        </button>
        <button type="submit" name="decision" value="rejected" disabled={pending} className={secondaryButtonClass}>
          {labels.reject}
        </button>
      </div>
      <ErrorLine state={state} template={labels.decisionFailed} />
    </form>
  );
}
