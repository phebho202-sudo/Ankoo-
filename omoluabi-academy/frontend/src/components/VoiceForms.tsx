"use client";

import { useActionState } from "react";
import {
  approvePresenterAction,
  rateTestAction,
  requestRunAction,
  requestTestAction,
  savePresenterAction,
  uploadPortraitAction,
  type VResult,
} from "@/app/voice-actions";
import { JobWatcher, type JobLabels } from "@/components/JobWatcher";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import type { Presenter, VoiceTest } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type VT = Dictionary["voice"];
const idle: VResult = { status: "idle" };
const label = "block text-sm font-medium text-navy";

function Msg({ state, ok, t }: { state: VResult; ok?: string; t?: VT }) {
  if (state.status === "error")
    return (
      <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
        <p>{state.message}</p>
        {t && state.problems && (
          <ul className="mt-1 list-disc pl-5">
            {state.problems.map((p) => <li key={p}>{(t.problems as Record<string, string>)[p] ?? p}</li>)}
          </ul>
        )}
      </div>
    );
  if (state.status === "ok" && ok) return <p role="status" className="text-sm text-emerald-800">✓ {ok}</p>;
  return null;
}

export function PresenterForm({ t, p }: { t: VT; p: Presenter | null }) {
  const [state, action, pending] = useActionState<VResult, FormData>(savePresenterAction, idle);
  return (
    <form action={action} className="space-y-4">
      {p?.status === "approved" && <p className="rounded-md bg-gold-100/60 px-3 py-2 text-xs">{t.changeResets}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>{t.name}<input name="name" lang="yo" required defaultValue={p?.name ?? ""} className={`mt-1 ${inputClass}`} /></label>
        <label className={label}>{t.voiceId}<input name="voice_id" defaultValue={p?.voice_id ?? ""} className={`mt-1 ${inputClass}`} /></label>
        <label className={label}>{t.voiceModel}<input name="voice_model" defaultValue={p?.voice_model ?? ""} className={`mt-1 ${inputClass}`} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className={label}>{t.stability}<input name="stability" type="number" step="0.05" min="0" max="1" defaultValue={p?.voice_settings?.stability ?? ""} className={`mt-1 ${inputClass}`} /></label>
          <label className={label}>{t.similarity}<input name="similarity_boost" type="number" step="0.05" min="0" max="1" defaultValue={p?.voice_settings?.similarity_boost ?? ""} className={`mt-1 ${inputClass}`} /></label>
        </div>
      </div>
      <p className="text-xs text-charcoal-400">{t.voiceHelp}</p>
      <label className={label}>{t.description}<textarea name="description" rows={2} lang="yo" defaultValue={p?.description ?? ""} className={`mt-1 ${inputClass}`} /></label>
      <fieldset className="space-y-2 rounded-md border border-navy-100 bg-cream-50 p-3 text-sm">
        <legend className="px-1 font-semibold text-navy">{t.declarations}</legend>
        <label className="flex items-start gap-2"><input type="checkbox" name="decl_voice" defaultChecked={p?.voice_is_original_or_licensed} className="mt-1 accent-gold" />{t.declVoice}</label>
        <label className="flex items-start gap-2"><input type="checkbox" name="decl_portrait" defaultChecked={p?.portrait_is_original_or_licensed} className="mt-1 accent-gold" />{t.declPortrait}</label>
        <label className="flex items-start gap-2"><input type="checkbox" name="decl_person" defaultChecked={p?.not_a_real_person} className="mt-1 accent-gold" />{t.declPerson}</label>
      </fieldset>
      <button type="submit" disabled={pending} className={buttonClass}>{t.save}</button>
      <Msg state={state} ok={t.saved} />
    </form>
  );
}

export function PortraitForm({ t }: { t: VT }) {
  const [state, action, pending] = useActionState<VResult, FormData>(uploadPortraitAction, idle);
  return (
    <form action={action} className="space-y-2">
      <label className={label}>{t.uploadPortrait}<input type="file" name="file" accept="image/png,image/jpeg" required className="mt-1 block w-full text-sm" /></label>
      <button type="submit" disabled={pending} className={secondaryButtonClass}>{t.upload}</button>
      <Msg state={state} />
    </form>
  );
}

export function ApproveForm({ t }: { t: VT }) {
  const [state, action, pending] = useActionState<VResult>(approvePresenterAction, idle);
  return (
    <form action={action} className="space-y-2">
      <button type="submit" disabled={pending} className={buttonClass}>{t.approve}</button>
      <Msg state={state} t={t} />
    </form>
  );
}

export function RequestTestForm({ t, jobLabels }: { t: VT; jobLabels: JobLabels }) {
  const [state, action, pending] = useActionState<VResult>(requestTestAction, idle);
  return (
    <form action={action} className="space-y-2">
      <button type="submit" disabled={pending} className={secondaryButtonClass}>{t.runTest}</button>
      {state.status === "ok" && state.jobId && <JobWatcher key={state.jobId} jobId={state.jobId} labels={jobLabels} />}
      <Msg state={state} />
    </form>
  );
}

export function RateTestForm({ t, test }: { t: VT; test: VoiceTest }) {
  const [state, action, pending] = useActionState<VResult, FormData>(rateTestAction, idle);
  const needed = [...new Set(test.passage.flatMap((i) => i.checks))];
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="id" value={test.id} />
      <ul className="space-y-1 text-sm">
        {needed.map((c) => (
          <li key={c}>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="ok" value={c} className="mt-1 accent-gold" />
              {(t.checks as Record<string, string>)[c] ?? c}
            </label>
          </li>
        ))}
      </ul>
      <label className={label}>{t.notes}<textarea name="notes" rows={2} lang="yo" className={`mt-1 ${inputClass}`} /></label>
      <button type="submit" disabled={pending} className={buttonClass}>{t.submitRating}</button>
      <Msg state={state} />
    </form>
  );
}

export function ProduceForm({ t, scriptId }: { t: VT; scriptId: string }) {
  const [state, action, pending] = useActionState<VResult, FormData>(requestRunAction, idle);
  return (
    <form action={action}>
      <input type="hidden" name="script_id" value={scriptId} />
      <button type="submit" disabled={pending} className={secondaryButtonClass}>{t.produce}</button>
      <Msg state={state} />
    </form>
  );
}
