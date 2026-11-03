"use client";

import { useOptimistic, useTransition } from "react";
import { setStatus } from "@/app/actions";
import { STATUSES, type Status } from "@/lib/types";

const TONE: Record<Status, string> = {
  raw: "bg-stone-600 text-white",
  exploring: "bg-sky-600 text-white",
  active: "bg-emerald-600 text-white",
  parked: "bg-amber-500 text-stone-900",
  killed: "bg-red-600 text-white",
  done: "bg-violet-600 text-white",
};

/** One tap changes status; the highlight moves immediately. */
export function StatusPicker({ projectId, status }: { projectId: string; status: Status }) {
  const [shown, setShown] = useOptimistic(status);
  const [, startTransition] = useTransition();

  function choose(next: Status) {
    if (next === shown) return;
    startTransition(async () => {
      setShown(next);
      await setStatus(projectId, next);
    });
  }

  return (
    <div role="radiogroup" aria-label="Status" className="grid grid-cols-3 gap-2">
      {STATUSES.map((s) => {
        const selected = s === shown;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => choose(s)}
            className={`rounded-lg px-2 py-2.5 text-sm font-medium capitalize ${
              selected ? TONE[s] : "border border-border bg-surface text-muted"
            }`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
