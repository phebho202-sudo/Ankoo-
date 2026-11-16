"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import {
  addPronAction,
  addReviewerAction,
  addTermAction,
  changePasswordAction,
  createScriptAction,
  reviewScriptAction,
  reviseScriptAction,
  saveRevisionAction,
  scriptStatusAction,
  submitScriptAction,
  type Result,
} from "@/app/script-actions";
import { JobWatcher, type JobLabels } from "@/components/JobWatcher";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import type { EpisodeSummary, Segment, TopicItem } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type ST = Dictionary["scripts"];
const idle: Result = { status: "idle" };
const label = "block text-sm font-medium text-navy";

function Msg({ state, ok }: { state: Result; ok?: string }) {
  if (state.status === "error")
    return <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{state.message}</p>;
  if (state.status === "ok" && ok) return <p role="status" className="text-sm text-emerald-800">✓ {ok}</p>;
  return null;
}

export function NewScriptForm({ t, topics, episodes }: { t: ST; topics: TopicItem[]; episodes: EpisodeSummary[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(createScriptAction, idle);
  const [kind, setKind] = useState<"original_lesson" | "licensed_adaptation">("original_lesson");
  const [fmt, setFmt] = useState("long_form");
  return (
    <form action={action} className="space-y-4">
      <fieldset>
        <legend className="text-sm font-semibold text-navy">{t.kind}</legend>
        {(["original_lesson", "licensed_adaptation"] as const).map((k) => (
          <label key={k} className="mt-2 flex items-start gap-2 text-sm">
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="mt-1 accent-gold" />
            <span>
              <span className="font-medium">{t.kinds[k]}</span>
              <span className="block text-xs text-charcoal-400">{t.kindHelp[k]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {kind === "original_lesson" ? (
        topics.length ? (
          <label className={label}>
            {t.topic}
            <select name="topic_id" required className={`mt-1 ${inputClass}`}>
              {topics.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm text-charcoal-400">{t.noTopics}</p>
        )
      ) : episodes.length ? (
        <label className={label}>
          {t.episode}
          <select name="episode_id" required className={`mt-1 ${inputClass}`}>
            {episodes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} · {e.channel_title}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm text-charcoal-400">{t.noEpisodes}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          {t.format}
          <select name="format" value={fmt} onChange={(e) => setFmt(e.target.value)} className={`mt-1 ${inputClass}`}>
            <option value="long_form">{t.formats.long_form}</option>
            <option value="short">{t.formats.short}</option>
          </select>
        </label>
        {fmt === "long_form" && (
          <label className={label}>
            {t.minutes}
            <input type="number" name="target_minutes" min={1} max={30} defaultValue={8} className={`mt-1 ${inputClass}`} />
          </label>
        )}
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {t.create}
      </button>
      <Msg state={state} />
    </form>
  );
}

/** Refreshes the page while the language model is writing the script. */
export function GenerationWatcher({ id, revision }: { id: string; revision: number }) {
  const router = useRouter();
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const s = await scriptStatusAction(id);
      if (s && (s.status !== "generating" || s.revision !== revision)) {
        router.refresh();
        return;
      }
      setTimeout(tick, 2000);
    };
    const timer = setTimeout(tick, 1500);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id, revision, router]);
  return null;
}

export function ScriptEditor({
  t,
  id,
  titleYo,
  segments,
  canEdit,
  children,
}: {
  t: ST;
  id: string;
  titleYo: string;
  segments: Segment[];
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(titleYo);
  const [segs, setSegs] = useState<Segment[]>(segments);
  const [note, setNote] = useState("");
  const [state, setState] = useState<Result>(idle);
  const [pending, setPending] = useState(false);

  const editable = segs.filter((s) => !s.locked);
  const locked = segs.filter((s) => s.locked);
  const update = (i: number, key: keyof Segment, value: string) =>
    setSegs((all) => {
      const copy = all.filter((s) => !s.locked).map((s) => ({ ...s }));
      (copy[i] as Record<string, unknown>)[key] = value;
      return [...copy, ...all.filter((s) => s.locked)];
    });

  const save = (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    startTransition(async () => {
      const r = await saveRevisionAction(id, title, segs, note);
      setPending(false);
      setState(r);
      if (r.status === "ok") {
        setEditing(false);
        setNote("");
      }
    });
  };

  if (!editing) {
    return (
      <div>
        {children}
        {state.status === "ok" && <p role="status" className="mt-3 text-sm text-emerald-800">✓ {t.saved}</p>}
        {canEdit && (
          <button type="button" onClick={() => { setSegs(segments); setTitle(titleYo); setEditing(true); setState(idle); }} className={`mt-4 ${secondaryButtonClass}`}>
            {t.edit}
          </button>
        )}
      </div>
    );
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <label className={label}>
        {t.titleYo}
        <input lang="yo" value={title} onChange={(e) => setTitle(e.target.value)} required className={`mt-1 ${inputClass}`} />
      </label>
      {editable.map((s, i) => (
        <fieldset key={s.id + i} className="rounded-md border border-navy-100 bg-cream-50 p-3">
          <legend className="px-1 text-xs font-semibold text-navy-700">{i + 1}</legend>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium text-navy">
              {t.colYo}
              <textarea lang="yo" rows={3} value={s.text_yo} onChange={(e) => update(i, "text_yo", e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs font-medium text-navy">
              {t.colEn}
              <textarea rows={3} value={s.text_en} onChange={(e) => update(i, "text_en", e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <label className="flex-1 text-xs font-medium text-navy">
              {t.colVisual}
              <input value={s.visual} onChange={(e) => update(i, "visual", e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <button type="button" onClick={() => setSegs([...editable.filter((_, j) => j !== i), ...locked])} className="rounded px-2 py-2 text-xs text-red-800 hover:bg-red-50">
              {t.removeSegment}
            </button>
          </div>
        </fieldset>
      ))}
      {locked.map((s) => (
        <p key={s.id} className="rounded-md bg-navy-50 px-3 py-2 text-xs">🔒 {t.credit}: {s.text_en}</p>
      ))}
      <button type="button" onClick={() => setSegs([...editable, { id: `new${Date.now()}`, text_yo: "", text_en: "", visual: "" }, ...locked])} className={secondaryButtonClass}>
        + {t.addSegment}
      </button>
      <label className={label}>
        {t.changeNote}
        <input value={note} onChange={(e) => setNote(e.target.value)} required className={`mt-1 ${inputClass}`} />
      </label>
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {t.saveRevision}
        </button>
        <button type="button" onClick={() => setEditing(false)} className={secondaryButtonClass}>
          {t.cancel}
        </button>
      </div>
      <Msg state={state} />
    </form>
  );
}

export function SubmitForm({ t, id }: { t: ST; id: string }) {
  const [state, action, pending] = useActionState<Result, FormData>(submitScriptAction, idle);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <p className="text-xs text-charcoal-400">{t.submitHelp}</p>
      <button type="submit" disabled={pending} className={buttonClass}>
        {t.submit}
      </button>
      <Msg state={state} />
    </form>
  );
}

export function ReviewForm({ t, id, items }: { t: ST; id: string; items: string[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(reviewScriptAction, idle);
  // The clicked button's name/value is not reliably part of a form action's FormData, so each
  // button writes the decision into a hidden field synchronously before the form submits.
  const decision = useRef<HTMLInputElement>(null);
  const choose = (value: string) => () => {
    if (decision.current) decision.current.value = value;
  };
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input ref={decision} type="hidden" name="decision" defaultValue="" />
      <ul className="space-y-2 text-sm">
        {items.map((k) => (
          <li key={k}>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="checklist" value={k} className="mt-1 accent-gold" />
              {(t.checklist as Record<string, string>)[k] ?? k}
            </label>
          </li>
        ))}
      </ul>
      <label className={label}>
        {t.comments}
        <textarea name="comments" rows={3} lang="yo" className={`mt-1 ${inputClass}`} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" onClick={choose("approved")} disabled={pending} className={buttonClass}>
          {t.approve}
        </button>
        <button type="submit" onClick={choose("changes_requested")} disabled={pending} className={secondaryButtonClass}>
          {t.requestChanges}
        </button>
      </div>
      <Msg state={state} />
    </form>
  );
}

export function ReviseForm({ t, id, jobLabels }: { t: ST; id: string; jobLabels: JobLabels }) {
  const [state, action, pending] = useActionState<Result, FormData>(reviseScriptAction, idle);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <p className="text-xs text-charcoal-400">{t.reviseHelp}</p>
      <label className={label}>
        {t.instructions}
        <textarea name="instructions" rows={3} required minLength={5} className={`mt-1 ${inputClass}`} />
      </label>
      <button type="submit" disabled={pending} className={secondaryButtonClass}>
        {t.reviseButton}
      </button>
      {state.status === "ok" && state.jobId && <JobWatcher key={state.jobId} jobId={state.jobId} labels={jobLabels} />}
      <Msg state={state} />
    </form>
  );
}

export function TermForm({ t }: { t: Dictionary["dictionary"] }) {
  const [state, action, pending] = useActionState<Result, FormData>(addTermAction, idle);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className={label}>{t.english}<input name="english" required className={`mt-1 ${inputClass}`} /></label>
      <label className={label}>{t.yoruba}<input name="yoruba" lang="yo" required className={`mt-1 ${inputClass}`} /></label>
      <button type="submit" disabled={pending} className={secondaryButtonClass}>{t.add}</button>
      <div className="sm:col-span-3"><Msg state={state} /></div>
    </form>
  );
}

export function PronForm({ t }: { t: Dictionary["dictionary"] }) {
  const [state, action, pending] = useActionState<Result, FormData>(addPronAction, idle);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end">
      <label className={label}>{t.written}<input name="written" required className={`mt-1 ${inputClass}`} /></label>
      <label className={label}>{t.spoken}<input name="spoken" lang="yo" required className={`mt-1 ${inputClass}`} /></label>
      <label className={label}>
        {t.category}
        <select name="category" className={`mt-1 ${inputClass}`}>
          {Object.entries(t.categories).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className={secondaryButtonClass}>{t.add}</button>
      <div className="sm:col-span-4"><Msg state={state} /></div>
    </form>
  );
}

export function PasswordForm({ t }: { t: Dictionary["account"] }) {
  const [state, action, pending] = useActionState<Result, FormData>(changePasswordAction, idle);
  return (
    <form action={action} className="max-w-md space-y-3">
      <label className={label}>{t.current}<input type="password" name="current" autoComplete="current-password" required className={`mt-1 ${inputClass}`} /></label>
      <label className={label}>{t.next}<input type="password" name="next" autoComplete="new-password" required minLength={12} className={`mt-1 ${inputClass}`} /></label>
      <button type="submit" disabled={pending} className={buttonClass}>{t.save}</button>
      <Msg state={state} ok={t.done} />
    </form>
  );
}

export function ReviewerForm({ t }: { t: Dictionary["team"] }) {
  const [state, action, pending] = useActionState<Result, FormData>(addReviewerAction, idle);
  const [email, password] = state.status === "ok" && state.message ? state.message.split("\n") : ["", ""];
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className={label}>{t.name}<input name="display_name" required className={`mt-1 ${inputClass}`} /></label>
        <label className={label}>{t.email}<input type="email" name="email" required className={`mt-1 ${inputClass}`} /></label>
        <button type="submit" disabled={pending} className={secondaryButtonClass}>{t.add}</button>
      </div>
      {state.status === "ok" && (
        <p role="status" className="rounded-md border border-gold-300 bg-gold-100/60 px-3 py-2 text-sm">
          {t.tempPassword.replace("{email}", email).replace("{password}", password)}
        </p>
      )}
      <Msg state={state.status === "error" ? state : idle} />
    </form>
  );
}
