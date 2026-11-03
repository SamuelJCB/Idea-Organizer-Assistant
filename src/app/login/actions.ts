"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { ok: boolean; message: string } | null;

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: `Sign-in link sent to ${email}. Open it on this device.` };
}
