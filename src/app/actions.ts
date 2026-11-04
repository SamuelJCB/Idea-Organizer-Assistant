"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data";
import { isStatus, type Status } from "@/lib/types";

const MAX_TITLE = 200;
const MAX_TEXT = 20_000;

function text(formData: FormData, field: string, max = MAX_TEXT): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function orNull(value: string): string | null {
  return value === "" ? null : value;
}

export async function createProject(formData: FormData): Promise<void> {
  const title = text(formData, "title", MAX_TITLE);
  if (!title) return;
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("projects").insert({ title, user_id: userId });
  if (error) throw new Error(`Could not create project: ${error.message}`);
  refresh();
}

export type SaveState = { ok: boolean; message: string } | null;

export async function updateProject(
  id: string,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const title = text(formData, "title", MAX_TITLE);
  if (!title) return { ok: false, message: "Title can't be empty." };

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("projects")
    .update({
      title,
      domain: orNull(text(formData, "domain", 100)),
      next_action: orNull(text(formData, "next_action")),
      notes: orNull(text(formData, "notes")),
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  refresh();
  return { ok: true, message: "Saved" };
}

export async function setStatus(id: string, status: Status): Promise<void> {
  if (!isStatus(status)) throw new Error("Unknown status");
  const { supabase } = await requireUser();
  const { error } = await supabase.from("projects").update({ status }).eq("id", id);
  if (error) throw new Error(`Could not change status: ${error.message}`);
  refresh();
}

export async function addLog(projectId: string, formData: FormData): Promise<void> {
  const body = text(formData, "body");
  if (!body) return;
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("project_logs")
    .insert({ project_id: projectId, body, user_id: userId });
  if (error) throw new Error(`Could not add log entry: ${error.message}`);
  refresh();
}

export async function deleteProject(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(`Could not delete project: ${error.message}`);
  redirect("/");
}

export async function signOut(): Promise<void> {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// To-dos
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function addTodo(formData: FormData): Promise<void> {
  const body = text(formData, "body", 500);
  if (!body) return;
  const due = text(formData, "due_date", 10);
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("todos").insert({
    body,
    due_date: DATE_RE.test(due) ? due : null,
    user_id: userId,
  });
  if (error) throw new Error(`Could not add to-do: ${error.message}`);
  refresh();
}

export async function setTodoDone(id: string, done: boolean): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("todos")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(`Could not update to-do: ${error.message}`);
  refresh();
}

export async function deleteTodo(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) throw new Error(`Could not delete to-do: ${error.message}`);
  refresh();
}

export async function clearDoneTodos(): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("todos").delete().eq("done", true);
  if (error) throw new Error(`Could not clear to-dos: ${error.message}`);
  refresh();
}
