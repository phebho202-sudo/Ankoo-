"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions";

type Labels = {
  email: string;
  password: string;
  submit: string;
  submitting: string;
  invalid: string;
  locked: string;
  unreachable: string;
};

export function LoginForm({ labels }: { labels: Labels }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const field =
    "mt-1 block w-full rounded-md border border-navy-100 bg-white px-3 py-2 text-charcoal shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40";
  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {labels[state.error]}
        </p>
      )}
      <label className="block text-sm font-medium text-navy">
        {labels.email}
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.email ?? ""}
          className={field}
        />
      </label>
      <label className="block text-sm font-medium text-navy">
        {labels.password}
        <input name="password" type="password" autoComplete="current-password" required className={field} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-navy px-4 py-2.5 font-semibold text-cream shadow hover:bg-navy-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-60"
      >
        {pending ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
