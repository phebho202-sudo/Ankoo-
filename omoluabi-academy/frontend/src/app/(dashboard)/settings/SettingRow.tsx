"use client";

import { useActionState } from "react";
import { updateSettingAction } from "@/app/actions";
import type { SettingItem } from "@/lib/api";
import type { SettingFormState } from "@/lib/settings";

export type SettingRowLabels = {
  label: string;
  help: string;
  save: string;
  saving: string;
  saved: string;
  default: string;
  custom: string;
  changedBy: string;
  spendingLimit: string;
  range: string;
  confirmIncrease: string;
  needsConfirmation: string;
  autoPublishBlocked: string;
  invalid: string;
  failed: string;
  on: string;
  off: string;
  choices: Record<string, string>;
};

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

export function SettingRow({ item, labels }: { item: SettingItem; labels: SettingRowLabels }) {
  const [state, action, pending] = useActionState<SettingFormState, FormData>(updateSettingAction, {
    status: "idle",
  });
  const id = `setting-${item.key.replace(/\W/g, "-")}`;
  const input =
    "w-full rounded-md border border-navy-100 bg-white px-3 py-2 text-sm shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40";

  let control: React.ReactNode;
  if (item.kind === "bool") {
    control = (
      <select id={id} name="value" defaultValue={String(item.value)} className={input}>
        <option value="false">{labels.off}</option>
        <option value="true">{labels.on}</option>
      </select>
    );
  } else if (item.kind === "choice") {
    control = (
      <select id={id} name="value" defaultValue={String(item.value)} className={input}>
        {item.choices.map((c) => (
          <option key={c} value={c}>
            {labels.choices[c] ?? c}
          </option>
        ))}
      </select>
    );
  } else {
    control = (
      <div className="flex items-center gap-2">
        <input
          id={id}
          name="value"
          type="number"
          inputMode="decimal"
          defaultValue={String(item.value)}
          min={item.minimum ?? undefined}
          max={item.maximum ?? undefined}
          step={item.kind === "int" ? 1 : 0.01}
          required
          className={`${input} tabular-nums`}
        />
        {item.unit && <span className="text-sm text-charcoal-400">{item.unit}</span>}
      </div>
    );
  }

  const errorText =
    state.status === "error"
      ? {
          needs_confirmation: labels.needsConfirmation,
          auto_publish_blocked: labels.autoPublishBlocked,
          invalid: fill(labels.invalid, { msg: state.message }),
          failed: fill(labels.failed, { msg: state.message }),
        }[state.reason]
      : null;

  return (
    <form action={action} className="grid gap-3 py-4 md:grid-cols-[1fr_minmax(0,16rem)] md:gap-6">
      <input type="hidden" name="key" value={item.key} />
      <input type="hidden" name="kind" value={item.kind} />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="font-medium text-navy">
            {labels.label}
          </label>
          {item.spending_limit && (
            <span className="rounded bg-gold-100 px-1.5 py-0.5 text-[11px] font-semibold text-gold-600">
              {labels.spendingLimit}
            </span>
          )}
          <span className="rounded bg-navy-50 px-1.5 py-0.5 text-[11px] text-navy-700">
            {item.is_default ? labels.default : labels.custom}
          </span>
        </div>
        <p className="mt-1 text-sm text-charcoal-400">{labels.help}</p>
        {item.minimum !== null && item.maximum !== null && (
          <p className="mt-1 text-xs text-charcoal-400">
            {fill(labels.range, { min: item.minimum, max: item.maximum })}
          </p>
        )}
        {item.updated_by && (
          <p className="mt-1 text-xs text-charcoal-400">{fill(labels.changedBy, { who: item.updated_by })}</p>
        )}
      </div>
      <div className="space-y-2">
        {control}
        {item.spending_limit && (
          <label className="flex items-start gap-2 text-xs text-charcoal">
            <input type="checkbox" name="confirm_increase" className="mt-0.5 accent-gold" />
            {labels.confirmIncrease}
          </label>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-navy px-4 py-1.5 text-sm font-semibold text-cream hover:bg-navy-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-60"
          >
            {pending ? labels.saving : labels.save}
          </button>
          {state.status === "saved" && !pending && (
            <span role="status" className="text-sm text-emerald-800">
              ✓ {labels.saved}
            </span>
          )}
        </div>
        {errorText && !pending && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900">
            {errorText}
          </p>
        )}
      </div>
    </form>
  );
}
