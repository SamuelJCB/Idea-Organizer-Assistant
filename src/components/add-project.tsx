"use client";

import { useRef, useState, useTransition } from "react";
import { createProject } from "@/app/actions";

/** A "+" that opens into a one-line input. Enter adds a raw project, Esc cancels. */
export function AddProject() {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(formData: FormData) {
    setOpen(false);
    startTransition(() => createProject(formData));
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add project"
        title="Add project"
        className="px-1 text-2xl leading-none font-light text-muted hover:text-foreground"
      >
        +
      </button>
    );
  }

  return (
    <form action={submit} className="flex w-56 min-w-0 shrink">
      <label htmlFor="new-project" className="sr-only">
        New project title
      </label>
      <input
        ref={inputRef}
        id="new-project"
        name="title"
        required
        autoFocus
        maxLength={200}
        autoComplete="off"
        enterKeyHint="done"
        placeholder="New project — Enter to add"
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        onBlur={() => !inputRef.current?.value && setOpen(false)}
        className="w-full rounded-full border border-border bg-surface px-3 py-1 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </form>
  );
}
