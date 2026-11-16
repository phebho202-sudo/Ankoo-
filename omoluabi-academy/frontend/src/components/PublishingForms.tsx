"use client";

import { type FormEvent, startTransition, useActionState, useRef, useState } from "react";
import {
  cancelAction,
  connectAction,
  connectSampleAction,
  disconnectAction,
  pauseAction,
  type PubResult,
  resolveAction,
  runNowAction,
  scheduleAction,
} from "@/app/publishing-actions";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import type { PublishOptions } from "@/lib/api";

const idle: PubResult = { status: "idle" };
const label = "block text-sm font-medium text-navy";

function Msg({ state, ok }: { state: PubResult; ok?: string }) {
  if (state.status === "error")
    return <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{state.message}</p>;
  if (state.status === "ok" && ok) return <p role="status" className="text-sm text-emerald-800">✓ {ok}</p>;
  return null;
}

type Action = (p: PubResult, f: FormData) => Promise<PubResult>;
const ACTIONS: Record<string, Action> = {
  connect: connectAction,
  connectSample: connectSampleAction,
  disconnect: disconnectAction,
  cancel: cancelAction,
  pause: pauseAction,
  runNow: runNowAction as unknown as Action,
};

/** A single button posting a few hidden fields to one server action. */
export function ActionButton({
  action,
  fields,
  text,
  ok,
  primary,
}: {
  action: keyof typeof ACTIONS;
  fields?: Record<string, string>;
  text: string;
  ok?: string;
  primary?: boolean;
}) {
  const [state, run, pending] = useActionState<PubResult, FormData>(ACTIONS[action], idle);
  return (
    <form action={run} className="inline-flex flex-col gap-1">
      {Object.entries(fields ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" disabled={pending} className={primary ? buttonClass : secondaryButtonClass}>{text}</button>
      <Msg state={state} ok={ok} />
    </form>
  );
}

type ScheduleLabels = {
  video: string; destination: string; account: string; noAccount: string; when: string; whenHelp: string;
  visibility: string; title: string; description: string; scheduleButton: string; scheduled: string;
  unavailable: string; doesNotFit: string;
  visibilities: Record<string, string>; destinations: Record<string, string>;
};

export function ScheduleForm({ videos, options, t }: { videos: { id: string; title: string }[]; options: Record<string, PublishOptions>; t: ScheduleLabels }) {
  const [state, action, pending] = useActionState<PubResult, FormData>(scheduleAction, idle);
  const [renderId, setRenderId] = useState(videos[0]?.id ?? "");
  const dests = options[renderId]?.destinations ?? [];
  const firstUsable = dests.find((d) => d.fits && d.accounts.length && d.visibilities.length)?.destination ?? dests[0]?.destination ?? "";
  const [destination, setDestination] = useState(firstUsable);
  const d = dests.find((x) => x.destination === destination);
  const usable = !!d && d.fits && d.accounts.length > 0 && d.visibilities.length > 0;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return (
    <form onSubmit={submit} className="space-y-3" data-testid="schedule-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          {t.video}
          <select name="render_id" value={renderId} onChange={(e) => { setRenderId(e.target.value); setDestination(options[e.target.value]?.destinations.find((x) => x.fits && x.accounts.length && x.visibilities.length)?.destination ?? ""); }} className={`mt-1 ${inputClass}`} lang="yo">
            {videos.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
        </label>
        <label className={label}>
          {t.destination}
          <select name="destination" value={destination} onChange={(e) => setDestination(e.target.value)} className={`mt-1 ${inputClass}`}>
            {dests.map((x) => {
              const why = !x.fits ? t.doesNotFit : !x.accounts.length ? t.noAccount : !x.visibilities.length ? t.unavailable : "";
              return <option key={x.destination} value={x.destination}>{t.destinations[x.destination] ?? x.destination}{why ? ` — ${why}` : ""}</option>;
            })}
          </select>
        </label>
      </div>
      {d && !usable && (
        <p className="rounded-md bg-gold-100/60 px-3 py-2 text-sm" data-testid="unavailable">
          {!d.fits ? t.doesNotFit : !d.accounts.length ? t.noAccount : t.unavailable}
        </p>
      )}
      {d && usable && (
        <div key={`${renderId}-${destination}`} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={label}>
              {t.account}
              <select name="account_id" className={`mt-1 ${inputClass}`}>
                {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className={label}>
              {t.visibility}
              <select name="visibility" defaultValue={d.default_visibility ?? undefined} className={`mt-1 ${inputClass}`}>
                {d.visibilities.map((v) => <option key={v} value={v}>{t.visibilities[v] ?? v}</option>)}
              </select>
            </label>
            <label className={label}>
              {t.when}
              <input type="datetime-local" name="when" className={`mt-1 ${inputClass}`} />
            </label>
          </div>
          <p className="text-xs text-charcoal-400">{t.whenHelp}</p>
          {d.caption.title && (
            <label className={label}>
              {t.title}
              <input name="title" lang="yo" maxLength={200} defaultValue={d.caption.title} className={`mt-1 ${inputClass}`} />
            </label>
          )}
          <label className={label}>
            {t.description}
            <textarea name="description" lang="yo" rows={7} maxLength={5000} defaultValue={d.caption.description} className={`mt-1 ${inputClass} text-sm`} />
          </label>
        </div>
      )}
      <button type="submit" disabled={pending || !usable} className={buttonClass}>{t.scheduleButton}</button>
      <Msg state={state} ok={t.scheduled} />
    </form>
  );
}

export function ResolveForm({ id, t }: { id: string; t: { onPlatform: string; notOnPlatform: string; url: string } }) {
  const [state, action, pending] = useActionState<PubResult, FormData>(resolveAction, idle);
  // Set synchronously by the clicked button (a submitter's value is not reliably sent).
  const found = useRef<HTMLInputElement>(null);
  const setFound = (v: string) => { if (found.current) found.current.value = v; };
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input ref={found} type="hidden" name="found" defaultValue="yes" />
      <label className={label}>{t.url}<input name="url" type="url" className={`mt-1 ${inputClass}`} /></label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" onClick={() => setFound("yes")} disabled={pending} className={buttonClass}>{t.onPlatform}</button>
        <button type="submit" onClick={() => setFound("no")} disabled={pending} className={secondaryButtonClass}>{t.notOnPlatform}</button>
      </div>
      <Msg state={state} />
    </form>
  );
}
