"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import {
  checkRightsAction,
  originalityAction,
  revokeLicenceAction,
  saveLicenceAction,
  setChannelBasisAction,
  setScopeAction,
  uploadDocumentAction,
  verifyLicenceAction,
  type CheckResult,
  type FormResult,
  type OriginalityState,
} from "@/app/rights-actions";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import type { EpisodeSummary, LicenceDetail, OriginalityResult } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { describeProblem, describeReason, toDateInput } from "@/lib/rights";

type RT = Dictionary["rights"];
const idle: FormResult = { status: "idle" };
const RIGHTS = ["translation", "adaptation", "commercial", "distribution"] as const;
const PLATFORMS = ["youtube", "facebook", "instagram", "tiktok"] as const;

function Err({ state, t }: { state: FormResult; t?: RT }) {
  if (state.status !== "error") return null;
  return (
    <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      <p>{state.message}</p>
      {t && state.problems && (
        <ul className="mt-1 list-disc pl-5">
          {state.problems.map((p) => (
            <li key={p}>{describeProblem(p, t)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Submit without React's automatic form reset. After a form action React resets uncontrolled
 * fields to the values the form was *loaded* with, so an edited licence would show (and could
 * re-save) stale values. Keeping the entered values shows exactly what was saved.
 */
function submitKeepingValues(action: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
}

function Ok({ show, text }: { show: boolean; text: string }) {
  return show ? <span role="status" className="text-sm text-emerald-800">✓ {text}</span> : null;
}

const label = "block text-sm font-medium text-navy";

export function LicenceForm({ t, licence }: { t: RT; licence?: LicenceDetail }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(saveLicenceAction, idle);
  const [attr, setAttr] = useState(licence?.attribution_required ?? false);
  const f = t.form;
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-5">
      {licence && <input type="hidden" name="id" value={licence.id} />}
      {licence?.status === "verified" && <p className="rounded-md bg-gold-100/60 px-3 py-2 text-xs">{f.editResets}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          {f.reference}
          <input name="licence_reference" required defaultValue={licence?.licence_reference} className={`mt-1 ${inputClass}`} />
        </label>
        <label className={label}>
          {f.licensor}
          <input name="licensor_name" required defaultValue={licence?.licensor_name} className={`mt-1 ${inputClass}`} />
        </label>
        <label className={label}>
          {f.contact}
          <input name="licensor_contact" defaultValue={licence?.licensor_contact ?? ""} className={`mt-1 ${inputClass}`} />
        </label>
        <label className={label}>
          {f.territory}
          <input name="territory" defaultValue={licence?.territory ?? ""} placeholder="Worldwide" className={`mt-1 ${inputClass}`} />
        </label>
        <label className={label}>
          {f.signedOn}
          <input type="date" name="signed_on" defaultValue={toDateInput(licence?.signed_on ?? null)} className={`mt-1 ${inputClass}`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            {f.effectiveFrom}
            <input type="date" name="effective_from" required defaultValue={toDateInput(licence?.effective_from ?? null)} className={`mt-1 ${inputClass}`} />
          </label>
          <label className={label}>
            {f.expiresAt}
            <input type="date" name="expires_at" required defaultValue={toDateInput(licence?.expires_at ?? null)} className={`mt-1 ${inputClass}`} />
          </label>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-navy">{f.rights}</legend>
        <p className="mb-2 text-xs text-charcoal-400">{f.rightsHelp}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {RIGHTS.map((r) => (
            <label key={r} className={label}>
              {t.rightNames[r]}
              <select name={r} defaultValue={licence?.[r] ?? "unclear"} className={`mt-1 ${inputClass}`}>
                {(["granted", "not_granted", "unclear"] as const).map((g) => (
                  <option key={g} value={g}>
                    {t.grant[g]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="text-sm font-semibold text-navy">{f.platforms}</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            {PLATFORMS.map((p) => (
              <label key={p} className="flex items-center gap-2">
                <input type="checkbox" name="permitted_platforms" value={p} defaultChecked={licence?.permitted_platforms.includes(p)} className="accent-gold" />
                {t.platformNames[p]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={label}>
          {f.languages}
          <input name="permitted_languages" defaultValue={(licence?.permitted_languages ?? ["yo"]).join(", ")} className={`mt-1 ${inputClass}`} />
        </label>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="attribution_required" checked={attr} onChange={(e) => setAttr(e.target.checked)} className="accent-gold" />
          {f.attributionRequired}
        </label>
        {attr && (
          <label className={label}>
            {f.attributionText}
            <input name="attribution_text" defaultValue={licence?.attribution_text ?? ""} className={`mt-1 ${inputClass}`} />
          </label>
        )}
        <label className={label}>
          {f.description}
          <textarea name="description" rows={2} defaultValue={licence?.description ?? ""} className={`mt-1 ${inputClass}`} />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {f.save}
        </button>
        <Ok show={state.status === "ok" && !pending} text={f.saved} />
      </div>
      {state.status === "error" && <Err state={{ ...state, message: f.failed.replace("{msg}", state.message) }} />}
    </form>
  );
}

export function DocumentUpload({ t, id }: { t: RT; id: string }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(uploadDocumentAction, idle);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className={label}>
        {t.upload}
        <input type="file" name="file" required accept="application/pdf,image/png,image/jpeg" className="mt-1 block w-full text-sm" />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={secondaryButtonClass}>
          {t.uploadButton}
        </button>
        <Ok show={state.status === "ok" && !pending} text={t.uploaded} />
      </div>
      <Err state={state} />
    </form>
  );
}

export function ScopeForm({
  t,
  licence,
  channels,
  episodes,
}: {
  t: RT;
  licence: LicenceDetail;
  channels: { id: string; title: string }[];
  episodes: EpisodeSummary[];
}) {
  const [state, action, pending] = useActionState<FormResult, FormData>(setScopeAction, idle);
  const chosen = new Set(licence.episodes.map((e) => e.id));
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-3">
      <input type="hidden" name="id" value={licence.id} />
      <label className={label}>
        {t.scopeChannel}
        <select name="channel_id" defaultValue={licence.channel_id ?? ""} className={`mt-1 ${inputClass}`}>
          <option value="">{t.scopeNoChannel}</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="text-sm font-medium text-navy">{t.scopeEpisodes}</legend>
        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-md border border-navy-100 bg-white p-2 text-sm">
          {episodes.map((e) => (
            <label key={e.id} className="flex items-start gap-2">
              <input type="checkbox" name="episode_ids" value={e.id} defaultChecked={chosen.has(e.id)} className="mt-1 accent-gold" />
              <span>
                {e.title} <span className="text-xs text-charcoal-400">· {e.channel_title}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={secondaryButtonClass}>
          {t.saveScope}
        </button>
        <Ok show={state.status === "ok" && !pending} text={t.form.saved} />
      </div>
      <Err state={state} />
    </form>
  );
}

export function VerifyForm({ t, id, problems }: { t: RT; id: string; problems: string[] }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(verifyLicenceAction, idle);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {problems.length > 0 && (
        <div className="rounded-md border border-gold-300 bg-gold-100/50 px-3 py-2 text-sm">
          <p className="font-medium">{t.problemsTitle}</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((p) => (
              <li key={p}>{describeProblem(p, t)}</li>
            ))}
          </ul>
        </div>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirmed" required className="mt-1 accent-gold" />
        {t.confirm}
      </label>
      <button type="submit" disabled={pending || problems.length > 0} className={buttonClass}>
        {t.verify}
      </button>
      <Err state={state} t={t} />
    </form>
  );
}

export function RevokeForm({ t, id }: { t: RT; id: string }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(revokeLicenceAction, idle);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className={label}>
        {t.revokeReason}
        <input name="reason" required minLength={5} className={`mt-1 ${inputClass}`} />
      </label>
      <button type="submit" disabled={pending} className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60">
        {t.revoke}
      </button>
      <Err state={state} />
    </form>
  );
}

export function RightsCheckForm({
  t,
  episodes,
  episodeId,
}: {
  t: RT;
  episodes?: EpisodeSummary[];
  episodeId?: string;
}) {
  const [state, action, pending] = useActionState<CheckResult, FormData>(checkRightsAction, { status: "idle" });
  const [purpose, setPurpose] = useState("adaptation");
  return (
    <form action={action} className="space-y-3">
      {episodeId ? (
        <input type="hidden" name="episode_id" value={episodeId} />
      ) : (
        <label className={label}>
          {t.episode}
          <select name="episode_id" required className={`mt-1 ${inputClass}`}>
            {(episodes ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} · {e.channel_title}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          {t.purpose}
          <select name="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} className={`mt-1 ${inputClass}`}>
            <option value="adaptation">{t.purposes.adaptation}</option>
            <option value="publish">{t.purposes.publish}</option>
          </select>
        </label>
        {purpose === "publish" && (
          <label className={label}>
            {t.platform}
            <select name="platform" className={`mt-1 ${inputClass}`}>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {t.platformNames[p]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <button type="submit" disabled={pending} className={secondaryButtonClass}>
        {t.runCheck}
      </button>
      {state.status === "done" &&
        (state.decision.allowed ? (
          <p role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            ✓ {t.allowed.replace("{licence}", state.licenceRef ?? "")}
          </p>
        ) : (
          <div role="status" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
            <p className="font-semibold">✕ {t.denied}</p>
            <ul className="mt-1 list-disc pl-5">
              {state.decision.reasons.map((r, i) => (
                <li key={i}>{describeReason(r, t)}</li>
              ))}
            </ul>
          </div>
        ))}
      {state.status === "error" && <p role="alert" className="text-sm text-red-800">{state.message}</p>}
    </form>
  );
}

type Match = OriginalityResult["matches"][number];

/** The same passage can appear in several sources: show it once, with every source listed. */
function groupMatches(matches: Match[]): { excerpt: string; sources: Match[] }[] {
  const groups = new Map<string, Match[]>();
  for (const m of matches) groups.set(m.excerpt, [...(groups.get(m.excerpt) ?? []), m]);
  return [...groups].map(([excerpt, sources]) => ({ excerpt, sources }));
}

export function OriginalityForm({ t }: { t: RT }) {
  const [state, action, pending] = useActionState<OriginalityState, FormData>(originalityAction, { status: "idle" });
  return (
    <form action={action} className="space-y-3">
      <label className={label}>
        {t.originalityText}
        <textarea name="text" required rows={5} className={`mt-1 ${inputClass}`} />
      </label>
      <button type="submit" disabled={pending} className={secondaryButtonClass}>
        {t.runOriginality}
      </button>
      {state.status === "done" &&
        (!state.result.flagged ? (
          <p role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            ✓ {t.originalityClear}
          </p>
        ) : (
          <div role="status" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
            <p className="font-semibold">{t.originalityFlagged}</p>
            <ul className="mt-2 space-y-3">
              {groupMatches(state.result.matches.filter((m) => m.flagged)).map((g) => (
                <li key={g.excerpt}>
                  <blockquote className="border-l-4 border-red-300 pl-2 italic">“{g.excerpt}”</blockquote>
                  <ul className="mt-1 text-xs">
                    {g.sources.map((m) => (
                      <li key={m.episode_id}>
                        {t.originalityMatch.replace("{words}", String(m.words)).replace("{title}", m.episode_title)}{" "}
                        {!m.used_transcript && t.noTranscriptCaveat}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ))}
      {state.status === "error" && <p role="alert" className="text-sm text-red-800">{state.message}</p>}
    </form>
  );
}

export function ChannelBasisForm({
  t,
  channelId,
  current,
  labels,
}: {
  t: RT;
  channelId: string;
  current: "research_only" | "licensed";
  labels: { basisResearch: string; basisLicensed: string };
}) {
  const [state, action, pending] = useActionState<FormResult, FormData>(setChannelBasisAction, idle);
  const next = current === "licensed" ? "research_only" : "licensed";
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs text-navy underline decoration-gold/60 underline-offset-2">{t.changeBasis}</summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="channel_id" value={channelId} />
        <input type="hidden" name="basis" value={next} />
        <p className="text-xs">→ {next === "licensed" ? labels.basisLicensed : labels.basisResearch}</p>
        <input name="note" required minLength={15} placeholder={t.changeBasisNote} aria-label={t.changeBasisNote} className={inputClass} />
        <button type="submit" disabled={pending} className={secondaryButtonClass}>
          {t.changeBasis}
        </button>
        <Err state={state} />
      </form>
    </details>
  );
}
