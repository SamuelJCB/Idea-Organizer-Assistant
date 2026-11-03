"use client";

import { useActionState } from "react";
import { updateProject, type SaveState } from "@/app/actions";
import { DOMAIN_SUGGESTIONS, type Project } from "@/lib/types";

export function ProjectForm({ project }: { project: Project }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(
    updateProject.bind(null, project.id),
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Title" htmlFor="title">
        <input
          id="title"
          name="title"
          required
          maxLength={200}
          defaultValue={project.title}
          className="input"
        />
      </Field>

      <Field label="Next action" htmlFor="next_action" hint="The single concrete next step.">
        <textarea
          id="next_action"
          name="next_action"
          rows={2}
          defaultValue={project.next_action ?? ""}
          className="input"
        />
      </Field>

      <Field label="Domain" htmlFor="domain">
        <input
          id="domain"
          name="domain"
          list="domain-options"
          maxLength={100}
          autoComplete="off"
          defaultValue={project.domain ?? ""}
          className="input"
        />
        <datalist id="domain-options">
          {DOMAIN_SUGGESTIONS.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </Field>

      <Field label="Notes" htmlFor="notes">
        <textarea
          id="notes"
          name="notes"
          rows={6}
          defaultValue={project.notes ?? ""}
          className="input"
        />
      </Field>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save"}
        </button>
        {state && !pending && (
          <span
            role="status"
            className={`text-sm ${state.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {hint && <span className="ml-2 font-normal text-muted">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
