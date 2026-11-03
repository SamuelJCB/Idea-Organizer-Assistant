import { Suspense } from "react";
import { signOut } from "@/app/actions";
import { ProjectCard } from "@/components/project-card";
import { QuickCapture } from "@/components/quick-capture";
import { getProjects } from "@/lib/data";
import { isStale } from "@/lib/time";
import { STATUS_ORDER, type Status } from "@/lib/types";

const SECTION_LABEL: Record<Status, string> = {
  active: "Active",
  exploring: "Exploring",
  raw: "Raw ideas",
  parked: "Parked",
  done: "Done",
  killed: "Killed",
};

/** These start collapsed so the live work stays on screen. */
const COLLAPSED: readonly Status[] = ["parked", "done", "killed"];

export default function Dashboard() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
      <header className="flex items-center justify-between pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <h1 className="text-xl font-semibold tracking-tight">Project Hub</h1>
        <form action={signOut}>
          <button type="submit" className="text-sm text-muted">
            Sign out
          </button>
        </form>
      </header>

      <div className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 py-2 backdrop-blur">
        <QuickCapture />
      </div>

      <Suspense fallback={<ListSkeleton />}>
        <ProjectList />
      </Suspense>
    </main>
  );
}

async function ProjectList() {
  const { projects, now } = await getProjects();

  if (projects.length === 0) {
    return (
      <p className="mt-10 text-center text-sm text-muted">
        No projects yet. Type an idea above and press Enter.
      </p>
    );
  }

  const staleCount = projects.filter((p) => isStale(p, now)).length;

  return (
    <div className="mt-4 flex flex-col gap-6">
      {staleCount > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {staleCount} live project{staleCount === 1 ? "" : "s"} untouched for 14+ days. Move,
          park, or kill {staleCount === 1 ? "it" : "them"}.
        </p>
      )}

      {STATUS_ORDER.map((status) => {
        const group = projects.filter((p) => p.status === status);
        if (group.length === 0) return null;

        const cards = (
          <div className="mt-2 flex flex-col gap-2">
            {group.map((p) => (
              <ProjectCard key={p.id} project={p} now={now} />
            ))}
          </div>
        );
        const heading = (
          <>
            {SECTION_LABEL[status]} <span className="font-normal text-muted">{group.length}</span>
          </>
        );

        return COLLAPSED.includes(status) ? (
          <details key={status} className="group">
            <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-wide">
              <span className="mr-1 inline-block transition-transform group-open:rotate-90">›</span>
              {heading}
            </summary>
            {cards}
          </details>
        ) : (
          <section key={status}>
            <h2 className="text-sm font-semibold uppercase tracking-wide">{heading}</h2>
            {cards}
          </section>
        );
      })}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-4 flex flex-col gap-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-border/60" />
      ))}
    </div>
  );
}
