import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types";
import { supabaseEnv } from "./env";

/** Supabase client acting as the signed-in user (RLS applies). Server only. */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. The proxy refreshes the
          // session on every request, so this is safe to ignore.
        }
      },
    },
  });
}
