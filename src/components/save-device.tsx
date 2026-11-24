"use client";

import { useState } from "react";
import { MAX_DEVICES, markDeviceSaved, useDeviceSaved, usePasskeySupport } from "@/lib/passkey";
import { createClient } from "@/lib/supabase/browser";

/** Header link that saves this device for Touch ID / Face ID login. */
export function SaveDevice() {
  const supported = usePasskeySupport();
  const alreadySaved = useDeviceSaved();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!supported || alreadySaved || saved) return null;

  function finish() {
    markDeviceSaved();
    setSaved(true);
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { data: devices, error: listError } = await supabase.auth.passkey.list();
      if (listError) throw listError;
      if (devices.length >= MAX_DEVICES) {
        setMessage(`${MAX_DEVICES} devices are already saved`);
        return;
      }
      const { error } = await supabase.auth.registerPasskey();
      if (!error) return finish();
      // This device already has a Nova passkey.
      if ("code" in error && error.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") return finish();
      setMessage("Couldn't save this device");
    } catch {
      setMessage("Couldn't save this device");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-3 text-sm">
      {message && <span className="text-red-600">{message}</span>}
      <button type="button" onClick={save} disabled={busy} className="text-muted hover:text-foreground">
        {busy ? "Waiting…" : "Save this device"}
      </button>
    </span>
  );
}
