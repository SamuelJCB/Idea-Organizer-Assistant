import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminClient, ownerId } from "@/lib/supabase/admin";
import { LIVE_STATUSES, STATUSES, isStatus, type Project } from "@/lib/types";

/**
 * Nova's Claude connector: a remote MCP server (stateless, JSON responses).
 * Add it in Claude under Settings → Connectors → Add custom connector, with
 * the URL https://<your-site>/api/mcp/<NOVA_CONNECTOR_TOKEN>.
 * The token in the URL is the password, so keep that URL private.
 */

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS = `Nova is Samuel's personal project tracker. It holds projects (ideas and ongoing work) and a separate quick to-do list.
- Project status is one of: raw (a fresh idea), exploring, active, parked, done, killed.
- When Samuel shares a new idea, call create_project with a short title and status "raw" unless he says otherwise. Put the details he gave in notes.
- To save information (for example from past chats) into a project, call add_note with a concise, well-organized summary. Each note is dated automatically.
- Small one-off tasks (homework, errands) are to-dos, not projects.
- Projects and to-dos can be referred to by id or by (part of) their title.
- After a change, briefly confirm what was saved.`;

type Json = Record<string, unknown>;
type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

class ToolError extends Error {}

const projectRef = {
  type: "string",
  description: "The project's id, or its title (or a distinctive part of it).",
};

const TOOLS = [
  {
    name: "list_projects",
    description: "List Nova projects with status, domain, next action and when each was last touched.",
    inputSchema: {
      type: "object",
      properties: {
        which: {
          type: "string",
          enum: ["live", "archived", "all"],
          description: "live = raw/exploring/active (default); archived = parked/done/killed.",
        },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_project",
    description: "Get one project with its full notes and its recent dated log notes.",
    inputSchema: { type: "object", properties: { project: projectRef }, required: ["project"] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "create_project",
    description: "Create a new project or idea in Nova.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short name for the project." },
        status: { type: "string", enum: [...STATUSES], description: "Defaults to raw." },
        domain: { type: "string", description: "e.g. hardware product, software, policy, finance, community." },
        next_action: { type: "string", description: "The single next concrete step." },
        notes: { type: "string", description: "Longer description or details." },
      },
      required: ["title"],
    },
  },
  {
    name: "update_project",
    description:
      "Change a project's title, status, domain, next action or notes. Notes are replaced, so to add information prefer add_note.",
    inputSchema: {
      type: "object",
      properties: {
        project: projectRef,
        title: { type: "string" },
        status: { type: "string", enum: [...STATUSES] },
        domain: { type: "string" },
        next_action: { type: "string" },
        notes: { type: "string" },
      },
      required: ["project"],
    },
  },
  {
    name: "add_note",
    description: "Add a dated note to a project's log, e.g. progress, decisions, or information gathered from past chats.",
    inputSchema: {
      type: "object",
      properties: { project: projectRef, text: { type: "string", description: "The note. Markdown is fine." } },
      required: ["project", "text"],
    },
  },
  {
    name: "list_todos",
    description: "List the quick to-do items (not projects).",
    inputSchema: {
      type: "object",
      properties: { include_done: { type: "boolean", description: "Also show completed items." } },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "add_todo",
    description: "Add a quick to-do item, optionally with a due date.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        due_date: { type: "string", description: "YYYY-MM-DD in Samuel's local time." },
      },
      required: ["text"],
    },
  },
  {
    name: "complete_todo",
    description: "Mark a to-do item as done.",
    inputSchema: {
      type: "object",
      properties: { todo: { type: "string", description: "The to-do's id, or (part of) its text." } },
      required: ["todo"],
    },
  },
];

export async function POST(request: NextRequest, ctx: RouteContext<"/api/mcp/[token]">) {
  const { token } = await ctx.params;
  if (!tokenMatches(token)) return new Response("Not found", { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(rpcError(null, -32700, "Parse error"), { status: 400 });
  }

  const messages = Array.isArray(body) ? body : [body];
  const replies = [];
  for (const message of messages) {
    const reply = await handle(message);
    if (reply) replies.push(reply);
  }

  if (replies.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? replies : replies[0]);
}

// No server-to-client stream; clients fall back to plain POST.
export function GET() {
  return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
}

function tokenMatches(given: string) {
  const expected = process.env.NOVA_CONNECTOR_TOKEN;
  if (!expected || expected.length < 24) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

async function handle(message: unknown) {
  if (!isObject(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(null, -32600, "Invalid request");
  }
  const id = message.id;
  // Notifications have no id and get no reply.
  if (id === undefined) return null;
  const params = isObject(message.params) ? message.params : {};

  switch (message.method) {
    case "initialize": {
      const asked = params.protocolVersion;
      const protocolVersion =
        typeof asked === "string" && PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0];
      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: "nova", title: "Nova", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: TOOLS });
    case "tools/call": {
      const name = params.name;
      const args = isObject(params.arguments) ? params.arguments : {};
      if (typeof name !== "string" || !TOOLS.some((t) => t.name === name)) {
        return rpcError(id, -32602, `Unknown tool: ${String(name)}`);
      }
      return rpcResult(id, await callTool(name, args));
    }
    default:
      return rpcError(id, -32601, `Method not found: ${message.method}`);
  }
}

async function callTool(name: string, args: Json): Promise<ToolResult> {
  try {
    return text(await runTool(name, args));
  } catch (error) {
    // Only the token holder sees this, and these messages never contain keys.
    const detail = isObject(error) && typeof error.message === "string" ? error.message : String(error);
    const msg = error instanceof ToolError ? error.message : `Nova had a problem: ${detail}`;
    if (!(error instanceof ToolError)) console.error("MCP tool error", name, error);
    return { ...text(msg), isError: true };
  }
}

async function runTool(name: string, args: Json): Promise<string> {
  const db = createAdminClient();
  const owner = ownerId();

  switch (name) {
    case "list_projects": {
      const which = args.which === "archived" || args.which === "all" ? args.which : "live";
      let query = db
        .from("projects")
        .select("*")
        .eq("user_id", owner)
        .order("last_touched", { ascending: false });
      if (which === "live") query = query.in("status", [...LIVE_STATUSES]);
      if (which === "archived") query = query.not("status", "in", `(${LIVE_STATUSES.join(",")})`);
      const { data, error } = await query;
      if (error) throw error;
      if (data.length === 0) return `No ${which === "all" ? "" : `${which} `}projects.`;
      return data.map(summarize).join("\n");
    }

    case "get_project": {
      const project = await findProject(args.project);
      const { data: logs, error } = await db
        .from("project_logs")
        .select("created_at, body")
        .eq("user_id", owner)
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return JSON.stringify({ ...publicFields(project), log: logs }, null, 2);
    }

    case "create_project": {
      const title = requiredText(args.title, "title");
      const status = args.status === undefined ? "raw" : args.status;
      if (!isStatus(status)) throw new ToolError(`status must be one of: ${STATUSES.join(", ")}`);
      const { data, error } = await db
        .from("projects")
        .insert({
          user_id: owner,
          title,
          status,
          domain: optionalText(args.domain),
          next_action: optionalText(args.next_action),
          notes: optionalText(args.notes),
        })
        .select()
        .single();
      if (error) throw error;
      return `Created project: ${summarize(data)}`;
    }

    case "update_project": {
      const project = await findProject(args.project);
      const changes: Partial<Project> = {};
      if (args.title !== undefined) changes.title = requiredText(args.title, "title");
      if (args.status !== undefined) {
        if (!isStatus(args.status)) throw new ToolError(`status must be one of: ${STATUSES.join(", ")}`);
        changes.status = args.status;
      }
      for (const field of ["domain", "next_action", "notes"] as const) {
        if (args[field] !== undefined) changes[field] = optionalText(args[field]);
      }
      if (Object.keys(changes).length === 0) throw new ToolError("Nothing to change.");
      const { data, error } = await db
        .from("projects")
        .update(changes)
        .eq("user_id", owner)
        .eq("id", project.id)
        .select()
        .single();
      if (error) throw error;
      return `Updated: ${summarize(data)}`;
    }

    case "add_note": {
      const project = await findProject(args.project);
      const body = requiredText(args.text, "text");
      const { error } = await db.from("project_logs").insert({ user_id: owner, project_id: project.id, body });
      if (error) throw error;
      return `Added a note to "${project.title}".`;
    }

    case "list_todos": {
      let query = db
        .from("todos")
        .select("*")
        .eq("user_id", owner)
        .order("done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at");
      if (args.include_done !== true) query = query.eq("done", false);
      const { data, error } = await query;
      if (error) throw error;
      if (data.length === 0) return "No to-dos.";
      return data
        .map((t) => `- ${t.done ? "[done] " : ""}${t.body}${t.due_date ? ` (due ${t.due_date})` : ""} [id ${t.id}]`)
        .join("\n");
    }

    case "add_todo": {
      const body = requiredText(args.text, "text");
      const due = optionalText(args.due_date);
      if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new ToolError("due_date must look like YYYY-MM-DD.");
      const { error } = await db.from("todos").insert({ user_id: owner, body, due_date: due });
      if (error) throw error;
      return `Added to-do: ${body}${due ? ` (due ${due})` : ""}`;
    }

    case "complete_todo": {
      const ref = requiredText(args.todo, "todo");
      const { data, error } = await db.from("todos").select("*").eq("user_id", owner).eq("done", false);
      if (error) throw error;
      const todo = pickOne(data, ref, (t) => t.body, "open to-do");
      const { error: updateError } = await db
        .from("todos")
        .update({ done: true, done_at: new Date().toISOString() })
        .eq("user_id", owner)
        .eq("id", todo.id);
      if (updateError) throw updateError;
      return `Done: ${todo.body}`;
    }
  }
  throw new ToolError(`Unknown tool: ${name}`);
}

/** Finds one of the owner's projects by id or by title. */
async function findProject(ref: unknown): Promise<Project> {
  const wanted = requiredText(ref, "project");
  const { data, error } = await createAdminClient().from("projects").select("*").eq("user_id", ownerId());
  if (error) throw error;
  return pickOne(data, wanted, (p) => p.title, "project");
}

function pickOne<T extends { id: string }>(rows: T[], ref: string, label: (row: T) => string, kind: string): T {
  const byId = rows.find((r) => r.id === ref);
  if (byId) return byId;
  const lower = ref.toLowerCase();
  const exact = rows.filter((r) => label(r).toLowerCase() === lower);
  if (exact.length === 1) return exact[0];
  const partial = exact.length > 1 ? exact : rows.filter((r) => label(r).toLowerCase().includes(lower));
  if (partial.length === 1) return partial[0];
  if (partial.length === 0) throw new ToolError(`No ${kind} matches "${ref}".`);
  throw new ToolError(
    `"${ref}" matches several: ${partial.map((r) => `"${label(r)}" [id ${r.id}]`).join(", ")}. Use the id.`,
  );
}

function summarize(p: Project) {
  const parts = [`${p.title} — ${p.status}`];
  if (p.domain) parts.push(p.domain);
  if (p.next_action) parts.push(`next: ${p.next_action}`);
  parts.push(`last touched ${p.last_touched.slice(0, 10)}`, `id ${p.id}`);
  return `- ${parts.join(" · ")}`;
}

function publicFields(p: Project) {
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    domain: p.domain,
    next_action: p.next_action,
    notes: p.notes,
    created_at: p.created_at,
    last_touched: p.last_touched,
  };
}

function requiredText(value: unknown, field: string) {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) throw new ToolError(`${field} is required.`);
  return s;
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function text(s: string): ToolResult {
  return { content: [{ type: "text", text: s }] };
}

function isObject(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
