import { TiltCard } from "@/components/tilt-card";
import { ageLabel, isStale } from "@/lib/time";
import type { Project, Status } from "@/lib/types";

export const STATUS_DOT: Record<Status, string> = {
  raw: "bg-stone-400",
  exploring: "bg-sky-500",
  active: "bg-emerald-500",
  parked: "bg-amber-500",
  killed: "bg-red-500",
  done: "bg-violet-500",
};

/**
 * One project as a card. Text sizes use container units (cqmin), so they
 * scale with the card: big cards get big titles, small cards stay legible.
 */
export function ProjectCard({ project, now }: { project: Project; now: number }) {
  const stale = isStale(project, now);

  return (
    <TiltCard
      href={`/projects/${project.id}`}
      className={stale ? "outline-2 outline-amber-400 dark:outline-amber-500/70" : ""}
    >
      {/* The outer box is the size container; the inner one can then size itself in cq units. */}
      <div className="h-full" style={{ containerType: "size" }}>
        <div className="flex h-full flex-col overflow-hidden p-[clamp(0.7rem,7cqmin,1.75rem)]">
          <div className="flex items-center justify-between gap-2 text-[clamp(0.65rem,4.5cqmin,0.85rem)]">
            <span className="flex min-w-0 items-center gap-1.5 font-medium uppercase tracking-wide text-muted">
              <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[project.status]}`} />
              <span className="truncate">{project.status}</span>
            </span>
            <span
              className={`shrink-0 ${stale ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted"}`}
            >
              {stale && <span aria-hidden>⚠ </span>}
              {ageLabel(project.last_touched, now)}
              {stale && <span className="sr-only"> (stale)</span>}
            </span>
          </div>

          <h3 className="mt-[clamp(0.25rem,3cqmin,0.75rem)] line-clamp-3 text-[clamp(0.95rem,9cqmin,1.9rem)] leading-tight font-semibold tracking-tight">
            {project.title}
          </h3>
          {project.domain && (
            <p className="mt-1 truncate text-[clamp(0.7rem,4.5cqmin,0.95rem)] text-muted">
              {project.domain}
            </p>
          )}

          <p
            className={`mt-auto line-clamp-3 pt-2 text-[clamp(0.75rem,5.5cqmin,1.05rem)] leading-snug ${
              project.next_action ? "" : "italic text-muted"
            }`}
          >
            {project.next_action ? `→ ${project.next_action}` : "No next action"}
          </p>
        </div>
      </div>
    </TiltCard>
  );
}
