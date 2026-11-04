import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LIVE_STATUSES, STATUS_ORDER, type Project, type ProjectLog, type Todo } from "@/lib/types";

/**
 * Returns a Supabase client plus the verified user id, or sends the visitor
 * to /login. Every read and write goes through this, so each one checks the
 * session itself instead of trusting the proxy alone.
 */
export async function requireUser() {
  // Per-request work: Supabase checks the login's expiry against the clock.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

/**
 * Everything the dashboard needs. Projects are split into live
 * (active/exploring/raw) and archived (parked/done/killed), each sorted by
 * status, then most recently touched.
 */
export async function getDashboard(): Promise<{
  live: Project[];
  archived: Project[];
  todos: Todo[];
  now: number;
}> {
  const { supabase } = await requireUser();
  const [projectsRes, todosRes] = await Promise.all([
    supabase.from("projects").select("*").order("last_touched", { ascending: false }),
    supabase.from("todos").select("*").order("created_at", { ascending: true }),
  ]);
  if (projectsRes.error) throw new Error(`Could not load projects: ${projectsRes.error.message}`);
  if (todosRes.error) throw new Error(`Could not load to-dos: ${todosRes.error.message}`);

  const rank = (p: Project) => STATUS_ORDER.indexOf(p.status);
  const sorted = [...projectsRes.data].sort((a, b) => rank(a) - rank(b));
  return {
    live: sorted.filter((p) => LIVE_STATUSES.includes(p.status)),
    archived: sorted.filter((p) => !LIVE_STATUSES.includes(p.status)),
    todos: todosRes.data,
    now: Date.now(),
  };
}

export async function getProjectWithLogs(
  id: string,
): Promise<{ project: Project; logs: ProjectLog[]; now: number }> {
  const { supabase } = await requireUser();
  const [projectRes, logsRes] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("project_logs")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
  ]);
  // A malformed id comes back as an error from Postgres; treat it as missing.
  if (projectRes.error?.code === "22P02") notFound();
  if (projectRes.error) throw new Error(`Could not load project: ${projectRes.error.message}`);
  if (!projectRes.data) notFound();
  if (logsRes.error) throw new Error(`Could not load log: ${logsRes.error.message}`);
  return { project: projectRes.data, logs: logsRes.data, now: Date.now() };
}
