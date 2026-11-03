import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Project, ProjectLog } from "@/lib/types";

/**
 * Returns a Supabase client plus the verified user id, or sends the visitor
 * to /login. Every read and write goes through this, so each one checks the
 * session itself instead of trusting the proxy alone.
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

/** `now` is when the data was read, used for "last touched" ages. */
export async function getProjects(): Promise<{ projects: Project[]; now: number }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("last_touched", { ascending: false });
  if (error) throw new Error(`Could not load projects: ${error.message}`);
  return { projects: data, now: Date.now() };
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
