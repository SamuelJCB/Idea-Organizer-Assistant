"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { moveProject } from "@/app/actions";
import {
  boardBox,
  dropTarget,
  labelBox,
  ringSlots,
  slotPath,
  wholeRing,
  type Ring,
  type Slot,
} from "@/lib/radial";
import { nextSteps, type Project } from "@/lib/types";

const DRAG_START_PX = 6;
const MOVE_MS = 240;
const INNER_STEPS = 2;

type Layout = Record<Ring, string[]>;
type Drag = { id: string; x: number; y: number; ring: Ring; preview: Layout };
type Press = { id: string; x: number; y: number };

function initialLayout(projects: Project[], order: string[]): Layout {
  const rank = new Map(order.map((id, i) => [id, i]));
  const position = (p: Project) => rank.get(p.id) ?? Number.MAX_SAFE_INTEGER;
  const sorted = [...projects].sort((a, b) => position(a) - position(b));
  return {
    inner: sorted.filter((p) => p.status === "active").map((p) => p.id),
    outer: sorted.filter((p) => p.status !== "active").map((p) => p.id),
  };
}

function targetSlots(layout: Layout) {
  const slots: Record<string, Slot> = {};
  for (const ring of ["inner", "outer"] as const) {
    const ringPieces = ringSlots(layout[ring].length, ring);
    layout[ring].forEach((id, i) => {
      slots[id] = ringPieces[i];
    });
  }
  return slots;
}

/** Slides pieces to their new places. Written by hand because Safari can't animate SVG paths. */
function useMovingSlots(target: Record<string, Slot>) {
  const [frame, setFrame] = useState(target);
  const latest = useRef(target);

  useEffect(() => {
    const from = latest.current;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();
    let raf = 0;

    const step = (time: number) => {
      const t = still ? 1 : Math.min((time - started) / MOVE_MS, 1);
      const eased = 1 - (1 - t) ** 3;
      const next: Record<string, Slot> = {};
      for (const [id, end] of Object.entries(target)) {
        const start = from[id] ?? end;
        const mix = (key: keyof Slot) => start[key] + (end[key] - start[key]) * eased;
        next[id] = { a0: mix("a0"), a1: mix("a1"), r0: mix("r0"), r1: mix("r1") };
      }
      latest.current = next;
      setFrame(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return frame;
}

export function ProjectBoard({
  projects,
  order,
  staleIds,
}: {
  projects: Project[];
  order: string[];
  staleIds: string[];
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const saved = useMemo(() => initialLayout(projects, order), [projects, order]);
  const [layout, setLayout] = useOptimistic(saved);
  const shown = drag?.preview ?? layout;
  const target = useMemo(() => targetSlots(shown), [shown]);
  const slots = useMovingSlots(target);
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const stale = useMemo(() => new Set(staleIds), [staleIds]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const box = size ? boardBox(size.width, size.height) : null;

  function pointIn(event: PointerEvent) {
    const rect = rootRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function previewAt(id: string, x: number, y: number) {
    const others: Layout = {
      inner: layout.inner.filter((p) => p !== id),
      outer: layout.outer.filter((p) => p !== id),
    };
    const { ring, index } = dropTarget(x, y, box!, (r) => others[r].length);
    const preview = { ...others, [ring]: others[ring].toSpliced(index, 0, id) };
    return { ring, preview };
  }

  function onPointerDown(event: PointerEvent<SVGPathElement>, id: string) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = { id, ...pointIn(event) };
  }

  function onPointerMove(event: PointerEvent<SVGPathElement>) {
    const held = press.current;
    if (!held || !box) return;
    const { x, y } = pointIn(event);
    if (!drag && Math.hypot(x - held.x, y - held.y) < DRAG_START_PX) return;
    setDrag({ id: held.id, x, y, ...previewAt(held.id, x, y) });
  }

  function onPointerUp() {
    const held = press.current;
    press.current = null;
    if (!held) return;
    if (!drag) {
      router.push(`/projects/${held.id}`);
      return;
    }
    const next = drag.preview;
    setDrag(null);
    if (JSON.stringify(next) === JSON.stringify(layout)) return;
    startTransition(async () => {
      setLayout(next);
      await moveProject(drag.id, drag.ring, [...next.inner, ...next.outer]);
    });
  }

  function onPointerCancel() {
    press.current = null;
    setDrag(null);
  }

  function onKeyDown(event: KeyboardEvent, id: string) {
    if (event.key === "Enter") router.push(`/projects/${id}`);
  }

  const dragged = drag ? byId.get(drag.id) : null;
  const pieces = [...shown.inner, ...shown.outer];

  return (
    <div ref={rootRef} className={`relative h-full w-full select-none ${drag ? "cursor-grabbing" : ""}`}>
      {box && size && (
        <>
          <svg width={size.width} height={size.height} className="absolute inset-0 overflow-visible">
            {(["inner", "outer"] as const).map(
              (ring) =>
                shown[ring].length === 0 && (
                  <path key={ring} d={slotPath(wholeRing(ring), box)} fillRule="evenodd" className="board-empty" />
                ),
            )}
            {pieces.map((id) => {
              const slot = slots[id] ?? target[id];
              const project = byId.get(id);
              if (!slot || !project) return null;
              const ring: Ring = shown.inner.includes(id) ? "inner" : "outer";
              const classes = [
                "board-piece",
                drag?.id === id ? "board-piece-held" : "",
                drag?.ring === ring ? "board-piece-target" : "",
                stale.has(id) ? "board-piece-stale" : "",
              ];
              return (
                <path
                  key={id}
                  d={slotPath(slot, box)}
                  fillRule="evenodd"
                  role="link"
                  tabIndex={0}
                  aria-label={`${project.title}, ${ring === "inner" ? "inner" : "outer"} ring`}
                  className={classes.join(" ")}
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => onPointerDown(e, id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerCancel}
                  onKeyDown={(e) => onKeyDown(e, id)}
                />
              );
            })}
          </svg>

          {pieces.map((id) => {
            const slot = slots[id] ?? target[id];
            const project = byId.get(id);
            if (!slot || !project || drag?.id === id) return null;
            const label = labelBox(slot, box);
            const inner = shown.inner.includes(id);
            const steps = inner && label.height > 78 ? nextSteps(project.next_action).slice(0, INNER_STEPS) : [];
            return (
              <div
                key={id}
                className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center overflow-hidden text-center"
                style={{ left: label.x, top: label.y, width: label.width, height: label.height }}
              >
                <h3
                  className={`line-clamp-2 leading-tight font-semibold tracking-tight ${
                    inner ? "text-[clamp(0.8rem,1.35vw,1.2rem)]" : "text-[clamp(0.75rem,1.05vw,1rem)]"
                  }`}
                >
                  {project.title}
                </h3>
                {steps.map((step) => (
                  <p key={step} className="mt-0.5 w-full truncate text-xs text-muted">
                    {step}
                  </p>
                ))}
              </div>
            );
          })}

          {dragged && drag && (
            <div
              className="pointer-events-none absolute z-10 max-w-48 -translate-x-1/2 -translate-y-1/2 truncate rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground shadow-lg"
              style={{ left: drag.x, top: drag.y }}
            >
              {dragged.title}
            </div>
          )}
        </>
      )}
    </div>
  );
}
