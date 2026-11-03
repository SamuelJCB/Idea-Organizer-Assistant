"use client";

import { useTransition } from "react";
import { deleteProject } from "@/app/actions";

export function DeleteProject({ projectId, title }: { projectId: string; title: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(`Delete "${title}" and its whole log? To keep a record, set it to Killed instead.`)) {
      return;
    }
    startTransition(() => deleteProject(projectId));
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-sm text-red-600 disabled:opacity-50 dark:text-red-400"
    >
      {pending ? "Deleting…" : "Delete project"}
    </button>
  );
}
