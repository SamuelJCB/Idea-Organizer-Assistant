"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ linkFailed }: { linkFailed: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        className="input"
      />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Sending…" : "Send sign-in link"}
      </button>
      {state && (
        <p
          role="status"
          className={state.ok ? "text-sm text-emerald-700 dark:text-emerald-400" : "text-sm text-red-600 dark:text-red-400"}
        >
          {state.message}
        </p>
      )}
      {!state && linkFailed && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          That sign-in link didn&apos;t work (it may have expired or been opened in a different
          browser). Send a new one.
        </p>
      )}
    </form>
  );
}
