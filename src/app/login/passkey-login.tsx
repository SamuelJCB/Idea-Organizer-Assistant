"use client";

import { useEffect, useState } from "react";
import { isDeviceSaved, usePasskeySupport } from "@/lib/passkey";
import { createClient } from "@/lib/supabase/browser";

/**
 * Touch ID / Face ID sign-in. On a saved device the prompt opens by itself.
 * Some browsers only allow it after a tap, so the button stays as the fallback.
 */
export function PasskeyLogin({ autoPrompt }: { autoPrompt: boolean }) {
  const supported = usePasskeySupport();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!supported || !autoPrompt || !isDeviceSaved()) return;
    const controller = new AbortController();
    createClient()
      .auth.signInWithPasskey({ options: { signal: controller.signal } })
      .then(({ data, error }) => {
        if (!error && data?.session) window.location.replace("/");
      })
      .catch(() => {
        // Blocked or dismissed: the button below still works.
      });
    return () => controller.abort();
  }, [supported, autoPrompt]);

  if (!supported) return null;

  async function signIn() {
    setBusy(true);
    setFailed(false);
    try {
      const { data, error } = await createClient().auth.signInWithPasskey();
      if (!error && data?.session) {
        window.location.replace("/");
        return;
      }
    } catch {
      // Shown below.
    }
    setFailed(true);
    setBusy(false);
  }

  return (
    <div className="mb-6 flex flex-col gap-3">
      <button type="button" onClick={signIn} disabled={busy} className="btn-primary">
        {busy ? "Waiting…" : "Sign in with Touch ID or Face ID"}
      </button>
      {failed && (
        <p role="alert" className="text-sm text-red-600">
          That didn&apos;t work. Try again, or use an email code below.
        </p>
      )}
      <p className="text-center text-xs text-muted">or use an email code</p>
    </div>
  );
}
