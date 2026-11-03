"use client";

import { useRef, useTransition } from "react";
import { createProject } from "@/app/actions";

/** Type a title, hit Enter: a new raw project exists. */
export function QuickCapture() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    formRef.current?.reset();
    startTransition(() => createProject(formData));
  }

  return (
    <form ref={formRef} action={submit} className="flex gap-2">
      <label htmlFor="quick-title" className="sr-only">
        New idea
      </label>
      <input
        id="quick-title"
        name="title"
        required
        maxLength={200}
        autoComplete="off"
        enterKeyHint="done"
        placeholder="New idea…"
        className="input"
      />
      <button type="submit" disabled={pending} className="btn-primary shrink-0">
        {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
