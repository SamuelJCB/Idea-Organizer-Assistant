import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { supabaseEnv } from "./env";

/**
 * Server-only Supabase client for the Claude connector, which has no browser
 * session. The secret key skips Row Level Security, so every query made with
 * this client must filter by `ownerId()` itself. Never import from client code.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set.");
  return createClient<Database>(supabaseEnv().url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The one Nova user the connector reads and writes for. */
export function ownerId() {
  const id = process.env.NOVA_USER_ID;
  if (!id) throw new Error("NOVA_USER_ID is not set.");
  return id;
}
