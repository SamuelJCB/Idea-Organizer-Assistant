import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/actions";
import { AddProject } from "@/components/add-project";
import { DashboardShell } from "@/components/dashboard-shell";
import { FitGrid } from "@/components/fit-grid";
import { ProjectCard } from "@/components/project-card";
import { TodoPanel } from "@/components/todo-panel";
import { getDashboard } from "@/lib/data";
import { isStale } from "@/lib/time";

export default function Dashboard({ searchParams }: PageProps<"/">) {
  return (
    <main className="flex h-dvh flex-col overflow-hidden px-4 lg:px-6">
      <header className="flex items-center justify-between pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <h1 className="text-lg font-semibold tracking-tight text-muted">Nova</h1>
        <form action={signOut}>
          <button type="submit" className="text-sm text-muted hover:text-foreground">
            Sign out
          </button>
        </form>
      </header>

      <Suspense fallback={<Skeleton />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function DashboardContent({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const { view } = await searchParams;
  const showArchive = view === "archive";
  const { live, archived, todos, now } = await getDashboard();
  const projects = showArchive ? archived : live;
  const staleCount = live.filter((p) => isStale(p, now)).length;

  return (
    <DashboardShell
      openTodos={todos.filter((t) => !t.done).length}
      todos={<TodoPanel todos={todos} />}
      grid={
        projects.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-muted dark:border-stone-700">
            {showArchive ? "Nothing parked, done, or killed yet." : "No live projects yet. Tap + below to add one."}
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <FitGrid>
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} now={now} />
              ))}
            </FitGrid>
          </div>
        )
      }
      bar={
        <>
          <ViewLink href="/" active={!showArchive} label="Live" count={live.length} />
          <AddProject />
          <ArchiveLink active={showArchive} count={archived.length} />
          {!showArchive && staleCount > 0 && (
            <span className="hidden text-xs text-amber-600 sm:inline dark:text-amber-400">
              {staleCount} untouched 14+ days
            </span>
          )}
        </>
      }
    />
  );
}

function ViewLink({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 ${active ? "font-medium text-foreground" : "text-muted hover:text-foreground"}`}
    >
      {label} <span className="text-muted">{count}</span>
    </Link>
  );
}

/** Parked, done and killed projects live behind a bin icon at the left of the bar. */
function ArchiveLink({ active, count }: { active: boolean; count: number }) {
  return (
    <Link
      href={active ? "/" : "/?view=archive"}
      aria-current={active ? "page" : undefined}
      aria-label={`Parked & closed projects (${count})`}
      title="Parked & closed"
      className={`absolute left-0 flex items-center gap-1 ${active ? "text-foreground" : "text-muted hover:text-foreground"}`}
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 1.8h7a2 2 0 0 0 2-1.8l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
      {count > 0 && <span className="text-xs">{count}</span>}
    </Link>
  );
}

function Skeleton() {
  return (
    <div className="flex min-h-0 flex-1 gap-5 pb-12" aria-hidden>
      <div className="flex-1 animate-pulse rounded-2xl bg-stone-200/60 dark:bg-stone-800/60" />
      <div className="hidden w-80 animate-pulse rounded-2xl bg-stone-200/60 lg:block xl:w-96 dark:bg-stone-800/60" />
    </div>
  );
}
