export const STATUSES = ["raw", "exploring", "active", "parked", "killed", "done"] as const;
export type Status = (typeof STATUSES)[number];

/** Dashboard section order: what needs attention first. */
export const STATUS_ORDER: readonly Status[] = [
  "active",
  "exploring",
  "raw",
  "parked",
  "done",
  "killed",
];

/** Statuses where a project is expected to move, so going quiet is a warning. */
export const LIVE_STATUSES: readonly Status[] = ["active", "exploring", "raw"];

export const STALE_DAYS = 14;

export const DOMAIN_SUGGESTIONS = [
  "hardware product",
  "software",
  "policy",
  "finance",
  "community",
  "physics",
];

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export type Project = {
  id: string;
  user_id: string;
  created_at: string;
  title: string;
  domain: string | null;
  status: Status;
  next_action: string | null;
  notes: string | null;
  last_touched: string;
};

export type ProjectLog = {
  id: string;
  project_id: string;
  user_id: string;
  created_at: string;
  body: string;
};

export type Todo = {
  id: string;
  user_id: string;
  created_at: string;
  body: string;
  /** Calendar date, "YYYY-MM-DD". */
  due_date: string | null;
  done: boolean;
  done_at: string | null;
};

/** Shape the Supabase client uses to type queries. Mirrors supabase/migrations. */
export type Database = {
  public: {
    Tables: {
      todos: {
        Row: Todo;
        Insert: {
          id?: string;
          user_id?: string;
          created_at?: string;
          body: string;
          due_date?: string | null;
          done?: boolean;
          done_at?: string | null;
        };
        Update: Partial<Todo>;
        Relationships: [];
      };
      projects: {
        Row: Project;
        Insert: {
          id?: string;
          user_id?: string;
          created_at?: string;
          title: string;
          domain?: string | null;
          status?: Status;
          next_action?: string | null;
          notes?: string | null;
          last_touched?: string;
        };
        Update: Partial<Project>;
        Relationships: [];
      };
      project_logs: {
        Row: ProjectLog;
        Insert: {
          id?: string;
          project_id: string;
          user_id?: string;
          created_at?: string;
          body: string;
        };
        Update: Partial<ProjectLog>;
        Relationships: [
          {
            foreignKeyName: "project_logs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/** Steps shown on a project's card. */
export const CARD_STEPS = 4;

/** A project's next steps: one per line of `next_action`, list markers removed. */
export function nextSteps(nextAction: string | null): string[] {
  if (!nextAction) return [];
  return nextAction
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•→]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}
