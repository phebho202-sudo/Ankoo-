"use client";

import { type FormEvent, startTransition, useActionState, useRef } from "react";
import { decideVideoAction, requestRenderAction, type VidResult } from "@/app/video-actions";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type VT = Dictionary["videos"];
const idle: VidResult = { status: "idle" };

function Err({ state, t }: { state: VidResult; t: VT }) {
  if (state.status !== "error") return null;
  const items = [...(state.failed ?? []), ...(state.missing ?? [])];
  const names = { ...t.checks, ...t.checklist } as Record<string, string>;
  return (
    <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      <p>{state.message}</p>
      {items.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {items.map((c) => <li key={c}>{names[c] ?? c}</li>)}
        </ul>
      )}
    </div>
  );
}

export function RenderForm({ t, runId, disabled }: { t: VT; runId: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<VidResult, FormData>(requestRenderAction, idle);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="run_id" value={runId} />
      <button type="submit" disabled={pending || disabled} className={buttonClass}>{t.render}</button>
      <Err state={state} t={t} />
    </form>
  );
}

export function DecisionForm({ t, id, items }: { t: VT; id: string; items: string[] }) {
  const [state, action, pending] = useActionState<VidResult, FormData>(decideVideoAction, idle);
  // The decision is set by the clicked button (a submitter's value is not reliably sent), and the
  // form is submitted without React's automatic reset so ticked boxes survive an error.
  const decision = useRef<HTMLInputElement>(null);
  const choose = (value: string) => () => {
    if (decision.current) decision.current.value = value;
  };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input ref={decision} type="hidden" name="decision" defaultValue="" />
      <ul className="space-y-1 text-sm">
        {items.map((c) => (
          <li key={c}>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="ok" value={c} className="mt-1 accent-gold" />
              {(t.checklist as Record<string, string>)[c] ?? c}
            </label>
          </li>
        ))}
      </ul>
      <label className="block text-sm font-medium text-navy">
        {t.notes}
        <textarea name="notes" rows={2} lang="yo" maxLength={4000} className={`mt-1 ${inputClass}`} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" onClick={choose("approved")} disabled={pending} className={buttonClass}>{t.approve}</button>
        <button type="submit" onClick={choose("rejected")} disabled={pending} className={secondaryButtonClass}>{t.reject}</button>
      </div>
      <Err state={state} t={t} />
    </form>
  );
}
