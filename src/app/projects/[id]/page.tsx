import Link from "next/link";
import { Suspense } from "react";
import { DeleteProject } from "@/components/delete-project";
import { LocalTime } from "@/components/local-time";
import { LogForm } from "@/components/log-form";
import { ProjectForm } from "@/components/project-form";
import { StatusPicker } from "@/components/status-picker";
import { getProjectWithLogs } from "@/lib/data";
import { ageLabel, isStale } from "@/lib/time";

export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
      <nav className="pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <Link href="/" className="text-sm text-muted">
          ← All projects
        </Link>
      </nav>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-border/60" />}>
        <ProjectDetail params={params} />
      </Suspense>
    </main>
  );
}

async function ProjectDetail({ params }: Pick<PageProps<"/projects/[id]">, "params">) {
  const { id } = await params;
  const { project, logs, now } = await getProjectWithLogs(id);
  const stale = isStale(project, now);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold leading-snug tracking-tight">{project.title}</h1>
        <p className={`text-xs ${stale ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted"}`}>
          {stale && "⚠ "}Last touched {ageLabel(project.last_touched, now)}
        </p>
        <StatusPicker projectId={project.id} status={project.status} />
      </section>

      <section>
        <ProjectForm project={project} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Log <span className="font-normal text-muted">{logs.length}</span>
        </h2>
        <LogForm projectId={project.id} />
        {logs.length > 0 && (
          <ol className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {logs.map((log) => (
              <li key={log.id} className="p-3">
                <p className="text-xs text-muted">
                  <LocalTime iso={log.created_at} />
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{log.body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="border-t border-border pt-4">
        <DeleteProject projectId={project.id} title={project.title} />
      </section>
    </div>
  );
}
