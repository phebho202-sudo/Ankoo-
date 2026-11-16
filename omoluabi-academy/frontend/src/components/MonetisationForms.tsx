"use client";

import { type FormEvent, type ReactNode, startTransition, useActionState, useEffect, useRef } from "react";
import {
  checkoutAction,
  linkAction,
  type MonResult,
  productAction,
  revenueAction,
  sponsorshipAction,
  sponsorshipStatusAction,
} from "@/app/monetisation-actions";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

const idle: MonResult = { status: "idle" };
const ACTIONS = {
  link: linkAction,
  product: productAction,
  checkout: checkoutAction,
  sponsorship: sponsorshipAction,
  sponsorStatus: sponsorshipStatusAction,
  revenue: revenueAction,
};
export const label = "block text-sm font-medium text-navy";
export const field = `mt-1 ${inputClass}`;

/**
 * A form posting to one server action. Values are kept after an error (no automatic reset);
 * after success the form is cleared for the next entry.
 */
export function MonForm({
  action,
  submit,
  ok,
  children,
  secondary,
  checkoutLabels,
  testId,
}: {
  action: keyof typeof ACTIONS;
  submit: string;
  ok?: string;
  children: ReactNode;
  secondary?: boolean;
  checkoutLabels?: { ready: string; sample: string };
  testId?: string;
}) {
  const [state, run, pending] = useActionState<MonResult, FormData>(ACTIONS[action], idle);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "ok" && !checkoutLabels) form.current?.reset();
  }, [state, checkoutLabels]);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await run(fd);
    });
  };
  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-3" data-testid={testId}>
      {children}
      <button type="submit" disabled={pending} className={secondary ? secondaryButtonClass : buttonClass}>{submit}</button>
      {state.status === "error" && <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{state.message}</p>}
      {state.status === "ok" && checkoutLabels && (
        <p role="status" className="text-sm text-emerald-800">
          {state.checkoutUrl ? (<>{checkoutLabels.ready} <a className="break-all underline" href={state.checkoutUrl} target="_blank" rel="noopener noreferrer">{state.checkoutUrl}</a></>) : checkoutLabels.sample}
        </p>
      )}
      {state.status === "ok" && !checkoutLabels && ok && <p role="status" className="text-sm text-emerald-800">✓ {ok}</p>}
    </form>
  );
}
