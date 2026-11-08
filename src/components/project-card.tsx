import { TiltCard } from "@/components/tilt-card";
import { ageLabel, isStale } from "@/lib/time";
import { CARD_STEPS, nextSteps, type Project, type Status } from "@/lib/types";

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
  const steps = nextSteps(project.next_action);

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

          <h3 className="mt-[clamp(0.25rem,3cqmin,0.75rem)] line-clamp-2 text-[clamp(0.95rem,9cqmin,1.9rem)] leading-tight font-semibold tracking-tight">
            {project.title}
          </h3>
          {project.domain && (
            <p className="mt-1 truncate text-[clamp(0.7rem,4.5cqmin,0.95rem)] text-muted">
              {project.domain}
            </p>
          )}

          {steps.length > 0 ? (
            <ul className="mt-auto space-y-0.5 pt-2 text-[clamp(0.7rem,4.8cqmin,0.95rem)] leading-snug text-muted">
              {steps.slice(0, CARD_STEPS).map((step, i) => (
                <li key={i} className="flex gap-1.5">
                  <span aria-hidden className="opacity-60">
                    ·
                  </span>
                  <span className="truncate">{step}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-auto pt-2 text-[clamp(0.7rem,4.8cqmin,0.95rem)] text-muted italic opacity-70">
              No next steps
            </p>
          )}
        </div>
      </div>
    </TiltCard>
  );
}
