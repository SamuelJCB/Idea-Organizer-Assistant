import Link from "next/link";
import { ageLabel, isStale } from "@/lib/time";
import type { Project } from "@/lib/types";

export function ProjectCard({ project, now }: { project: Project; now: number }) {
  const stale = isStale(project, now);

  return (
    <Link
      href={`/projects/${project.id}`}
      className={`block rounded-xl border bg-surface p-4 active:opacity-80 ${
        stale ? "border-amber-400 dark:border-amber-500/70" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium leading-snug">{project.title}</h3>
        <span
          className={`shrink-0 text-xs ${stale ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted"}`}
        >
          {stale && <span aria-hidden>⚠ </span>}
          {ageLabel(project.last_touched, now)}
          {stale && <span className="sr-only"> (stale)</span>}
        </span>
      </div>
      {project.domain && <p className="mt-0.5 text-xs text-muted">{project.domain}</p>}
      <p className={`mt-2 text-sm ${project.next_action ? "" : "italic text-muted"}`}>
        {project.next_action ? `→ ${project.next_action}` : "No next action"}
      </p>
    </Link>
  );
}
