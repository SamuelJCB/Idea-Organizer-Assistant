"use client";

import { useRef, useTransition } from "react";
import { addLog } from "@/app/actions";

export function LogForm({ projectId }: { projectId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    formRef.current?.reset();
    startTransition(() => addLog(projectId, formData));
  }

  return (
    <form ref={formRef} action={submit} className="flex flex-col gap-2">
      <label htmlFor="log-body" className="sr-only">
        New log entry
      </label>
      <textarea
        id="log-body"
        name="body"
        required
        rows={3}
        placeholder="Update, decision, or thought…"
        className="input"
      />
      <button type="submit" disabled={pending} className="btn-secondary self-start">
        {pending ? "Adding…" : "Add to log"}
      </button>
    </form>
  );
}
