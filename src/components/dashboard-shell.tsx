"use client";

import { useState, type ReactNode } from "react";

/**
 * Wide screens: project cards on the left, to-do column on the right, both
 * the same height, with the project bar underneath the cards.
 * Phones: one at a time, switched with a bottom tab bar.
 */
export function DashboardShell({
  grid,
  bar,
  todos,
  openTodos,
}: {
  grid: ReactNode;
  bar: ReactNode;
  todos: ReactNode;
  openTodos: number;
}) {
  const [tab, setTab] = useState<"projects" | "todos">("projects");
  const onProjects = tab === "projects";

  return (
    <>
      <div className="flex min-h-0 flex-1 gap-5">
        <section
          aria-label="Projects"
          className={`min-h-0 min-w-0 flex-1 flex-col ${onProjects ? "flex" : "hidden lg:flex"}`}
        >
          {grid}
        </section>
        <aside
          aria-label="To do"
          className={`min-h-0 w-full flex-col lg:w-80 lg:shrink-0 xl:w-96 ${onProjects ? "hidden lg:flex" : "flex"}`}
        >
          {todos}
        </aside>
      </div>

      {/* Bar sits under the cards, left-aligned; the spacer keeps it out from under the to-do column. */}
      <div className={`gap-5 py-3 ${onProjects ? "flex" : "hidden lg:flex"}`}>
        <div className="flex min-w-0 flex-1 items-center gap-5 text-sm">{bar}</div>
        <div className="hidden lg:block lg:w-80 lg:shrink-0 xl:w-96" />
      </div>

      <nav className="-mx-4 grid grid-cols-2 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {(
          [
            ["projects", "Projects"],
            ["todos", `To do${openTodos ? ` (${openTodos})` : ""}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`py-3 text-sm font-medium ${tab === key ? "text-foreground" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}
