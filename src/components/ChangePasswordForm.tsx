"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions";

const initial: { ok?: boolean; error?: string } = {};

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={action} className="max-w-sm space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="currentPassword" className="block text-sm font-medium text-ink">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-line-strong bg-paper px-3.5 py-2.5 text-ink focus:border-indigo focus:outline-none"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="newPassword" className="block text-sm font-medium text-ink">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className="w-full rounded-lg border border-line-strong bg-paper px-3.5 py-2.5 text-ink focus:border-indigo focus:outline-none"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className="w-full rounded-lg border border-line-strong bg-paper px-3.5 py-2.5 text-ink focus:border-indigo focus:outline-none"
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-rose/8 px-3 py-2 text-sm text-rose">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-teal/8 px-3 py-2 text-sm text-teal">
          Password changed. Use it next time you sign in.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo px-4 py-2.5 font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
      >
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
