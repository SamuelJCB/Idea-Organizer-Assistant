import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";
import { supabaseEnv } from "./env";

/** Browser Supabase client. Only used for Touch ID, which has to run on the device. */
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient<Database>(url, key);
}
