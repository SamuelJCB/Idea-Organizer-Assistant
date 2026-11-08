"use client";

import { useActionState } from "react";
import { sendMagicLink, verifyCode, type LoginState } from "./actions";

export function LoginForm({ linkFailed }: { linkFailed: boolean }) {
  const [sent, send, sending] = useActionState<LoginState, FormData>(sendMagicLink, null);
  const [checked, verify, verifying] = useActionState<LoginState, FormData>(verifyCode, null);

  // Step 2: the email went out (on success, sendMagicLink returns the address as its message).
  if (sent?.ok) {
    const email = sent.message;
    return (
      <form action={verify} className="flex flex-col gap-3">
        <input type="hidden" name="email" value={email} />
        <label htmlFor="code" className="text-sm font-medium">
          Code sent to {email}
        </label>
        <input
          id="code"
          name="code"
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9 ]*"
          maxLength={12}
          placeholder="123456"
          className="input text-center text-lg tracking-[0.3em]"
        />
        <button type="submit" disabled={verifying} className="btn-primary">
          {verifying ? "Checking…" : "Sign in"}
        </button>
        {checked && !checked.ok && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {checked.message}
          </p>
        )}
        <p className="text-sm text-muted">Or tap the link in the email if you&apos;re in a browser.</p>
      </form>
    );
  }

  return (
    <form action={send} className="flex flex-col gap-3">
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
      <button type="submit" disabled={sending} className="btn-primary">
        {sending ? "Sending…" : "Email me a code"}
      </button>
      {sent && !sent.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {sent.message}
        </p>
      )}
      {!sent && linkFailed && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          That sign-in link didn&apos;t work (it may have expired or been opened in a different
          browser). Send a new code.
        </p>
      )}
    </form>
  );
}
