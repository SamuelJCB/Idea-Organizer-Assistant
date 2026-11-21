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
  cornerSlot,
  dropTarget,
  emptyCorners,
  labelBox,
  MAX_PER_CORNER,
  ringSlots,
  slotPath,
  wholeRing,
  type Label,
  type Ring,
  type Slot,
} from "@/lib/radial";
import { nextSteps, type Project } from "@/lib/types";

const DRAG_START_PX = 6;
const MOVE_MS = 240;
/** Grey next-step text: one step, wrapped to at most two lines so it stays readable. */
const STEP_LINE_PX = 16;
const STEP_LINES = 2;
const STEP_ROOM = 4 + STEP_LINES * STEP_LINE_PX;
const MIN_STEP_WIDTH = 104;
const TITLE_SIZES: Record<Ring, { max: number; min: number }> = {
  inner: { max: 20, min: 12 },
  outer: { max: 17, min: 14 },
  corner: { max: 14, min: 11 },
};
/** Saved in the order list just before each corner's projects, so corners keep their place. */
const CORNER_MARKS = [0, 1, 2, 3].map((n) => `00000000-0000-4000-8000-c0000000000${n}`);
/** Conservative average character width and line height, as multiples of font size. */
const CHAR_WIDTH = 0.56;
const LINE_HEIGHT = 1.2;

/** `corners` has four lists: top-left, top-right, bottom-right, bottom-left. */
type Layout = { inner: string[]; outer: string[]; corners: string[][] };
type Drag = { id: string; x: number; y: number; ring: Ring; preview: Layout };
type Press = { id: string; x: number; y: number };

function initialLayout(projects: Project[], order: string[]): Layout {
  const rank = new Map(order.map((id, i) => [id, i]));
  const savedCorner = new Map<string, number>();
  let current = -1;
  for (const id of order) {
    const mark = CORNER_MARKS.indexOf(id);
    if (mark >= 0) current = mark;
    else if (current >= 0) savedCorner.set(id, current);
  }

  // Saved position first, then oldest first, so an edit never reshuffles the board.
  const position = (p: Project) => rank.get(p.id) ?? Number.MAX_SAFE_INTEGER;
  const sorted = [...projects].sort(
    (a, b) => position(a) - position(b) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );

  // Raw ideas live in the corners; any beyond their capacity join the outer ring.
  const corners: string[][] = [[], [], [], []];
  const raw = sorted.filter((p) => p.status === "raw");
  const unplaced = raw.filter((p) => {
    const corner = savedCorner.get(p.id);
    if (corner === undefined || corners[corner].length >= MAX_PER_CORNER) return true;
    corners[corner].push(p.id);
    return false;
  });
  for (const p of unplaced) {
    const roomiest = corners.reduce((best, ids, i) => (ids.length < corners[best].length ? i : best), 0);
    if (corners[roomiest].length < MAX_PER_CORNER) corners[roomiest].push(p.id);
  }

  const inCorner = new Set(corners.flat());
  return {
    inner: sorted.filter((p) => p.status === "active").map((p) => p.id),
    outer: sorted.filter((p) => p.status !== "active" && !inCorner.has(p.id)).map((p) => p.id),
    corners,
  };
}

function ringIds(layout: Layout, ring: Ring) {
  return ring === "corner" ? layout.corners.flat() : layout[ring];
}

function ringOf(layout: Layout, id: string): Ring {
  if (layout.inner.includes(id)) return "inner";
  return layout.corners.some((ids) => ids.includes(id)) ? "corner" : "outer";
}

/** The list saved to the database, with markers recording each corner. */
function savedOrder(layout: Layout) {
  return [...layout.inner, ...layout.outer, ...layout.corners.flatMap((ids, i) => [CORNER_MARKS[i], ...ids])];
}

function targetSlots(layout: Layout) {
  const slots: Record<string, Slot> = {};
  for (const ring of ["inner", "outer"] as const) {
    const ringPieces = ringSlots(layout[ring].length, ring);
    layout[ring].forEach((id, i) => {
      slots[id] = ringPieces[i];
    });
  }
  layout.corners.forEach((ids, corner) => {
    ids.forEach((id, part) => {
      slots[id] = cornerSlot(corner, part, ids.length);
    });
  });
  return slots;
}

/** How many lines the title takes at a font size, or null if a word won't fit. */
function wrappedLines(title: string, fontSize: number, width: number) {
  const perLine = Math.floor(width / (fontSize * CHAR_WIDTH));
  let lines = 1;
  let used = 0;
  for (const word of title.split(/\s+|(?<=\/)/)) {
    if (word.length > perLine) return null;
    if (used && used + 1 + word.length > perLine) {
      lines++;
      used = word.length;
    } else {
      used += (used ? 1 : 0) + word.length;
    }
  }
  return lines;
}

/** The largest size at which a title fits, leaving `reserve` px below it; null if none does. */
function largestSize(title: string, ring: Ring, label: Label, reserve = 0) {
  const { max, min } = TITLE_SIZES[ring];
  for (let size = max; size >= min; size--) {
    const lines = wrappedLines(title, size, label.width);
    if (lines && lines * size * LINE_HEIGHT + reserve <= label.height) return size;
  }
  return null;
}

/** Label width needed for a title's longest word at the ring's smallest size. */
function minLabelWidth(title: string, ring: Ring) {
  const longest = Math.max(...title.split(/\s+|(?<=\/)/).map((word) => word.length));
  const needed = Math.ceil(longest * TITLE_SIZES[ring].min * CHAR_WIDTH) + 4;
  return ring === "corner" ? needed : Math.max(110, needed);
}

/** Line count at the ring's shared size, and whether a next step also fits. */
function placeText(title: string, size: number, label: Label, hasStep: boolean) {
  const most = Math.max(1, Math.floor(label.height / (size * LINE_HEIGHT)));
  const lines = Math.min(wrappedLines(title, size, label.width) ?? most, most);
  const showStep = hasStep && label.width >= MIN_STEP_WIDTH && lines * size * LINE_HEIGHT + STEP_ROOM <= label.height;
  return { lines, showStep };
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
        // Triangles and hexagon pieces have different outlines, so they swap without morphing.
        if (start.corner || end.corner) {
          next[id] = end;
          continue;
        }
        const mix = (key: "a0" | "a1" | "r0" | "r1") => start[key] + (end[key] - start[key]) * eased;
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

  const box = useMemo(() => (size ? boardBox(size.width, size.height) : null), [size]);
  // Measured from where pieces are headed, not every animation frame.
  const labels = useMemo(() => {
    if (!box) return {};
    return Object.fromEntries(
      Object.entries(target).map(([id, slot]) => {
        const title = byId.get(id)?.title ?? "";
        const ring: Ring = slot.corner ? "corner" : slot.r0 < 1e-3 ? "inner" : "outer";
        return [id, labelBox(slot, box, minLabelWidth(title, ring))];
      }),
    );
  }, [target, box, byId]);

  function pointIn(event: PointerEvent) {
    const rect = rootRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function previewAt(id: string, x: number, y: number) {
    const others: Layout = {
      inner: layout.inner.filter((p) => p !== id),
      outer: layout.outer.filter((p) => p !== id),
      corners: layout.corners.map((ids) => ids.filter((p) => p !== id)),
    };
    const drop = dropTarget(x, y, box!, (r) => others[r].length, others.corners.map((ids) => ids.length));
    // Over a full corner: the piece stays where it was instead of landing somewhere else.
    if (!drop) return { ring: ringOf(layout, id), preview: layout };
    if (drop.ring === "corner") {
      const corners = others.corners.map((ids, i) => (i === drop.index ? ids.toSpliced(drop.part, 0, id) : ids));
      return { ring: drop.ring, preview: { ...others, corners } };
    }
    return { ring: drop.ring, preview: { ...others, [drop.ring]: others[drop.ring].toSpliced(drop.index, 0, id) } };
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
      await moveProject(drag.id, drag.ring, savedOrder(next));
    });
  }

  function onPointerCancel() {
    press.current = null;
    setDrag(null);
  }

  function onKeyDown(event: KeyboardEvent, id: string) {
    if (event.key === "Enter") router.push(`/projects/${id}`);
  }

  // Next steps show on every inner piece or none, so the ring stays even.
  // Titles shrink to make room, but only when that lets every piece show its step.
  const innerStepsFit = shown.inner.every((id) => {
    const project = byId.get(id);
    if (!project || !labels[id] || !nextSteps(project.next_action).length) return true;
    return labels[id].width >= MIN_STEP_WIDTH && largestSize(project.title, "inner", labels[id], STEP_ROOM) !== null;
  });

  // One title size per ring, so pieces read as a set.
  const ringSize = (ring: Ring) => {
    const sizes = ringIds(shown, ring).flatMap((id) => {
      const project = byId.get(id);
      if (!project || !labels[id]) return [];
      const reserve = ring === "inner" && innerStepsFit && nextSteps(project.next_action).length ? STEP_ROOM : 0;
      return [largestSize(project.title, ring, labels[id], reserve) ?? TITLE_SIZES[ring].min];
    });
    return sizes.length ? Math.min(...sizes) : TITLE_SIZES[ring].max;
  };
  const titleSize: Record<Ring, number> = {
    inner: ringSize("inner"),
    outer: ringSize("outer"),
    corner: ringSize("corner"),
  };

  const dragged = drag ? byId.get(drag.id) : null;
  const pieces = [...shown.inner, ...shown.outer, ...shown.corners.flat()];
  const heldCorner = drag ? target[drag.id]?.corner?.index : undefined;

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
            {emptyCorners(shown.corners.map((ids) => ids.length)).map((slot) => (
              <path
                key={`corner-${slot.corner?.index}`}
                d={slotPath(slot, box)}
                className={`board-corner-empty ${drag ? "board-corner-target" : ""}`}
              />
            ))}
            {/* A fixed DOM order: moving the held element would make the browser drop the drag. */}
            {pieces.toSorted().map((id) => {
              const slot = slots[id] ?? target[id];
              const project = byId.get(id);
              if (!slot || !project) return null;
              const ring = ringOf(shown, id);
              const classes = [
                "board-piece",
                ring === "inner" ? "board-piece-inner" : ring === "outer" ? "board-piece-outer" : "",
                drag?.id === id ? "board-piece-held" : "",
                (ring === "corner" ? slot.corner?.index === heldCorner : drag?.ring === ring)
                  ? "board-piece-target"
                  : "",
                stale.has(id) ? "board-piece-stale" : "",
              ];
              return (
                <path
                  key={id}
                  d={slotPath(slot, box)}
                  fillRule="evenodd"
                  role="link"
                  tabIndex={0}
                  aria-label={`${project.title}, ${ring} ring`}
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
            const label = labels[id];
            const project = byId.get(id);
            if (!label || !project || drag?.id === id) return null;
            const ring = ringOf(shown, id);
            const step = ring === "inner" && innerStepsFit ? nextSteps(project.next_action)[0] : undefined;
            const size = titleSize[ring];
            const text = placeText(project.title, size, label, Boolean(step));
            return (
              <div
                key={id}
                className="board-label pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center overflow-hidden text-center text-foreground"
                style={{ left: label.x, top: label.y, width: label.width, height: label.height }}
              >
                <h3
                  className="w-full font-medium tracking-tight text-balance"
                  style={{
                    fontSize: size,
                    lineHeight: LINE_HEIGHT,
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: text.lines,
                    overflow: "hidden",
                  }}
                >
                  {project.title.replace(/-/g, "-\u2060").replace(/\//g, "/\u200b")}
                </h3>
                {text.showStep && (
                  <p
                    className="mt-1 w-full text-xs text-foreground/70"
                    style={{
                      lineHeight: `${STEP_LINE_PX}px`,
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: STEP_LINES,
                      overflow: "hidden",
                    }}
                  >
                    {step}
                  </p>
                )}
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
