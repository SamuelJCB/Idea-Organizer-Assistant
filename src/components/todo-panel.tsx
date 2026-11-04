"use client";

import { useOptimistic, useRef, useSyncExternalStore, useTransition } from "react";
import { addTodo, clearDoneTodos, deleteTodo, setTodoDone } from "@/app/actions";
import type { Todo } from "@/lib/types";

type Change =
  | { type: "add"; todo: Todo }
  | { type: "toggle"; id: string; done: boolean }
  | { type: "delete"; id: string }
  | { type: "clear" };

function apply(todos: Todo[], change: Change): Todo[] {
  switch (change.type) {
    case "add":
      return [...todos, change.todo];
    case "toggle":
      return todos.map((t) => (t.id === change.id ? { ...t, done: change.done } : t));
    case "delete":
      return todos.filter((t) => t.id !== change.id);
    case "clear":
      return todos.filter((t) => !t.done);
  }
}

/** Open items first, soonest due first, undated last; done items at the bottom. */
function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.due_date !== b.due_date) {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    }
    return a.created_at < b.created_at ? -1 : 1;
  });
}

/** Today's date in the viewer's own time zone, as "YYYY-MM-DD". */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const noSubscribe = () => () => {};

/**
 * Reads today's date in the browser only. The server runs in a different time
 * zone, so it renders no due labels and the browser fills them in.
 */
function useToday(): string | null {
  return useSyncExternalStore(noSubscribe, localToday, () => null);
}

function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Today", "Tomorrow", "Fri", "Nov 14", or "Overdue". */
function dueLabel(due: string, today: string): { text: string; tone: string } {
  const dueDate = parseDay(due);
  const days = Math.round((dueDate.getTime() - parseDay(today).getTime()) / 86_400_000);

  if (days < 0) return { text: "Overdue", tone: "text-red-600 dark:text-red-400 font-medium" };
  if (days === 0) return { text: "Today", tone: "text-amber-600 dark:text-amber-400 font-medium" };
  if (days === 1) return { text: "Tomorrow", tone: "text-foreground" };
  if (days < 7) return { text: dueDate.toLocaleDateString(undefined, { weekday: "short" }), tone: "text-muted" };
  return {
    text: dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    tone: "text-muted",
  };
}

export function TodoPanel({ todos }: { todos: Todo[] }) {
  const [shown, change] = useOptimistic(todos, apply);
  const today = useToday();
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const sorted = sortTodos(shown);
  const doneCount = shown.filter((t) => t.done).length;
  const openCount = shown.length - doneCount;

  function add(formData: FormData) {
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    const due = String(formData.get("due_date") ?? "");
    formRef.current?.reset();
    startTransition(async () => {
      change({
        type: "add",
        todo: {
          id: `pending-${crypto.randomUUID()}`,
          user_id: "",
          created_at: new Date().toISOString(),
          body,
          due_date: due || null,
          done: false,
          done_at: null,
        },
      });
      await addTodo(formData);
    });
  }

  function run(c: Change, action: () => Promise<void>) {
    startTransition(async () => {
      change(c);
      await action();
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04),0_2px_8px_rgb(0_0_0/0.04)]">
      <div className="flex items-baseline justify-between px-4 pt-4">
        <h2 className="font-semibold tracking-tight">To do</h2>
        <span className="text-xs text-muted">{openCount} open</span>
      </div>

      {/* The date row only appears while typing a to-do, to keep the panel clean. */}
      <form ref={formRef} action={add} className="group flex flex-col gap-2 px-4 pt-3 pb-3">
        <label htmlFor="todo-body" className="sr-only">
          New to-do
        </label>
        <input
          id="todo-body"
          name="body"
          required
          maxLength={500}
          autoComplete="off"
          enterKeyHint="done"
          placeholder="Add a to-do…"
          className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        <div className="hidden items-center gap-2 group-focus-within:flex">
          <label htmlFor="todo-due" className="text-xs text-muted">
            Due
          </label>
          <input
            id="todo-due"
            name="due_date"
            type="date"
            className="min-w-0 flex-1 rounded-md bg-background px-2 py-1 text-xs text-foreground"
          />
          <button type="submit" className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            Add
          </button>
        </div>
      </form>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted">Nothing to do. Nice.</li>
        )}
        {sorted.map((todo) => {
          const due = todo.due_date && !todo.done && today ? dueLabel(todo.due_date, today) : null;
          const pending = todo.id.startsWith("pending-");
          return (
            <li key={todo.id} className="group flex items-start gap-3 px-4 py-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={todo.done}
                aria-label={`Mark "${todo.body}" ${todo.done ? "not done" : "done"}`}
                disabled={pending}
                onClick={() =>
                  run({ type: "toggle", id: todo.id, done: !todo.done }, () =>
                    setTodoDone(todo.id, !todo.done),
                  )
                }
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                  todo.done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-stone-300 dark:border-stone-600"
                }`}
              >
                {todo.done && "✓"}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm leading-snug break-words ${todo.done ? "text-muted line-through" : ""}`}>
                  {todo.body}
                </p>
                {due && (
                  <p className={`mt-0.5 text-xs ${due.tone}`}>
                    {due.text}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label={`Delete "${todo.body}"`}
                disabled={pending}
                onClick={() => run({ type: "delete", id: todo.id }, () => deleteTodo(todo.id))}
                className="shrink-0 px-1 text-lg leading-none text-muted opacity-60 hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>

      {doneCount > 0 && (
        <div className="px-4 py-2.5">
          <button
            type="button"
            onClick={() => run({ type: "clear" }, clearDoneTodos)}
            className="text-sm text-muted hover:text-foreground"
          >
            Clear {doneCount} completed
          </button>
        </div>
      )}
    </div>
  );
}
