"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions";

const initial: { error?: string } = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-ink">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          placeholder="you@jaipurrugs.org"
          className="w-full rounded-lg border border-line-strong bg-paper px-3.5 py-2.5 text-ink placeholder:text-faint focus:border-indigo focus:outline-none"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-ink">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Your password"
          className="w-full rounded-lg border border-line-strong bg-paper px-3.5 py-2.5 text-ink placeholder:text-faint focus:border-indigo focus:outline-none"
        />
      </div>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-rose/8 px-3 py-2 text-sm text-rose">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-indigo px-4 py-2.5 font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
