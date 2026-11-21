/**
 * Geometry for the dashboard board: one soft, rounded shape cut into an inner
 * ring of petals and an outer ring of blocks.
 * Radii are fractions of the board (0 = center, 1 = edge).
 */

export const INNER_RADIUS = 0.52;
/** Inner pieces stop short of the center, so they never end in a sharp point. */
const CORE_RADIUS = 0.09;
const START = -Math.PI / 2;
const TAU = Math.PI * 2;
const MAX_STRETCH = 1.25;
const GAP = 4;
const CORNER = 22;
const ARC_STEP = Math.PI / 45;
const LABEL_ARC_STEP = Math.PI / 18;
const LABEL_PADDING = 12;

export type Ring = "inner" | "outer";
export type Slot = { a0: number; a1: number; r0: number; r1: number };
export type Box = { cx: number; cy: number; rx: number; ry: number };
export type Label = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

export function boardBox(width: number, height: number): Box {
  const ry = Math.max(height / 2 - 2, 1);
  const rx = Math.min(Math.max(width / 2 - 2, 1), ry * MAX_STRETCH);
  return { cx: width / 2, cy: height / 2, rx, ry };
}

/** Evenly divides a ring, with the first piece centered at the top. */
export function ringSlots(count: number, ring: Ring): Slot[] {
  const span = TAU / Math.max(count, 1);
  const r0 = ring === "outer" ? INNER_RADIUS : count === 1 ? 0 : CORE_RADIUS;
  const r1 = ring === "inner" ? INNER_RADIUS : 1;
  return Array.from({ length: count }, (_, i) => {
    const a0 = START - span / 2 + i * span;
    return { a0, a1: a0 + span, r0, r1 };
  });
}

/** The whole ring as one piece, used for empty rings. */
export function wholeRing(ring: Ring): Slot {
  return ringSlots(1, ring)[0];
}

/** Which ring a point is over, and where a new piece would be inserted. */
export function dropTarget(x: number, y: number, box: Box, otherCount: (ring: Ring) => number) {
  const dx = (x - box.cx) / box.rx;
  const dy = (y - box.cy) / box.ry;
  const ring: Ring = Math.hypot(dx, dy) < INNER_RADIUS ? "inner" : "outer";
  const cells = otherCount(ring) + 1;
  const span = TAU / cells;
  const from = START - span / 2;
  const turned = (((Math.atan2(dy, dx) - from) % TAU) + TAU) % TAU;
  return { ring, index: Math.min(Math.floor(turned / span), cells - 1) };
}

function at(box: Box, r: number, a: number): Point {
  return { x: box.cx + r * box.rx * Math.cos(a), y: box.cy + r * box.ry * Math.sin(a) };
}

function arc(box: Box, r: number, a0: number, a1: number, step: number, closed = false) {
  const steps = Math.max(1, Math.ceil(Math.abs(a1 - a0) / step));
  const count = closed ? steps : steps + 1;
  return Array.from({ length: count }, (_, i) => at(box, r, a0 + ((a1 - a0) * i) / steps));
}

function signedArea(points: Point[]) {
  return points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0);
}

/** Moves each edge inward by `gap`; a negative gap moves it outward. */
function inset(points: Point[], gap: number): Point[] {
  const direction = signedArea(points) >= 0 ? 1 : -1;
  return points.map((p, i) => {
    const prev = points[(i - 1 + points.length) % points.length];
    const next = points[(i + 1) % points.length];
    const inLen = Math.hypot(p.x - prev.x, p.y - prev.y) || 1;
    const outLen = Math.hypot(next.x - p.x, next.y - p.y) || 1;
    const n1 = { x: (-(p.y - prev.y) / inLen) * direction, y: ((p.x - prev.x) / inLen) * direction };
    const n2 = { x: (-(next.y - p.y) / outLen) * direction, y: ((next.x - p.x) / outLen) * direction };
    const bx = n1.x + n2.x;
    const by = n1.y + n2.y;
    const len = Math.hypot(bx, by);
    if (len < 1e-6) return { x: p.x + n1.x * gap, y: p.y + n1.y * gap };
    const ux = bx / len;
    const uy = by / len;
    const miter = gap / Math.max(0.3, ux * n1.x + uy * n1.y);
    return { x: p.x + ux * miter, y: p.y + uy * miter };
  });
}

/** A piece's outline, plus which points are its true corners. */
function outline(slot: Slot, box: Box, step: number) {
  const { a0, a1, r0, r1 } = slot;
  const outer = arc(box, r1, a0, a1, step);
  if (r0 < 1e-3) {
    return { points: [at(box, 0, a0), ...outer], corners: [0, 1, outer.length] };
  }
  const inner = arc(box, r0, a1, a0, step);
  const n = outer.length;
  return { points: [...outer, ...inner], corners: [0, n - 1, n, n + inner.length - 1] };
}

function pathLength(points: Point[], from: number, to: number) {
  const n = points.length;
  let total = 0;
  for (let i = from; i !== to; i = (i + 1) % n) {
    const q = points[(i + 1) % n];
    total += Math.hypot(q.x - points[i].x, q.y - points[i].y);
  }
  return total;
}

/** Walks `distance` along the outline; returns the point and the next vertex beyond it. */
function walk(points: Point[], from: number, dir: 1 | -1, distance: number) {
  const n = points.length;
  let i = from;
  let left = distance;
  for (let guard = 0; guard < n; guard++) {
    const j = (i + dir + n) % n;
    const len = Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y);
    if (len >= left && len > 0) {
      const t = left / len;
      return {
        point: { x: points[i].x + (points[j].x - points[i].x) * t, y: points[i].y + (points[j].y - points[i].y) * t },
        beyond: j,
      };
    }
    left -= len;
    i = j;
  }
  return { point: points[from], beyond: from };
}

const num = (v: number) => v.toFixed(1);

/** Draws the outline with its true corners softly rounded. */
function roundedPath(points: Point[], corners: number[]) {
  const n = points.length;
  const lengths = corners.map((c, k) => pathLength(points, c, corners[(k + 1) % corners.length]));
  const cuts = corners.map((c, k) => {
    const before = lengths[(k - 1 + corners.length) % corners.length];
    const radius = Math.min(CORNER, before * 0.45, lengths[k] * 0.45);
    return { corner: points[c], in: walk(points, c, -1, radius), out: walk(points, c, 1, radius) };
  });

  let d = `M${num(cuts[0].in.point.x)} ${num(cuts[0].in.point.y)}`;
  cuts.forEach((cut, k) => {
    d += `Q${num(cut.corner.x)} ${num(cut.corner.y)} ${num(cut.out.point.x)} ${num(cut.out.point.y)}`;
    const nextK = (k + 1) % cuts.length;
    const start = corners[k];
    const span = (corners[nextK] - start + n) % n;
    const first = (cut.out.beyond - start + n) % n;
    const last = (cuts[nextK].in.beyond - start + n) % n;
    for (let o = first; o > 0 && o <= last && o < span; o++) {
      const p = points[(start + o) % n];
      d += `L${num(p.x)} ${num(p.y)}`;
    }
    d += `L${num(cuts[nextK].in.point.x)} ${num(cuts[nextK].in.point.y)}`;
  });
  return `${d}Z`;
}

function smoothLoop(points: Point[]) {
  return `M${points.map((p) => `${num(p.x)} ${num(p.y)}`).join("L")}Z`;
}

/** SVG path for a slot. A full outer ring has a hole, so use fill-rule="evenodd". */
export function slotPath(slot: Slot, box: Box) {
  const { a0, a1, r0, r1 } = slot;
  if (a1 - a0 > TAU - 1e-3) {
    const outer = smoothLoop(inset(arc(box, r1, a0, a1, ARC_STEP, true), GAP));
    if (r0 < 1e-3) return outer;
    return outer + smoothLoop(inset(arc(box, r0, a0, a1, ARC_STEP, true), -GAP));
  }
  const { points, corners } = outline(slot, box, ARC_STEP);
  return roundedPath(inset(points, GAP), corners);
}

function inside(p: Point, polygon: Point[]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

function rectFits(x: number, y: number, w: number, h: number, polygon: Point[]) {
  for (const fx of [-0.5, 0, 0.5]) {
    for (const fy of [-0.5, 0, 0.5]) {
      if (fx === 0 && fy === 0) continue;
      if (!inside({ x: x + fx * w, y: y + fy * h }, polygon)) return false;
    }
  }
  return true;
}

/** The largest text rectangle that sits fully inside a piece. */
export function labelBox(slot: Slot, box: Box): Label {
  const full = slot.a1 - slot.a0 > TAU - 1e-3;
  // A full outer ring has a hole, so its text uses the top section.
  const area =
    full && slot.r0 > 1e-3 ? { ...slot, a0: START - Math.PI / 3, a1: START + Math.PI / 3 } : slot;
  const raw =
    full && slot.r0 < 1e-3
      ? arc(box, slot.r1, slot.a0, slot.a1, LABEL_ARC_STEP, true)
      : outline(area, box, LABEL_ARC_STEP).points;
  const polygon = inset(raw, GAP + LABEL_PADDING);

  let best: Label = { ...at(box, (area.r0 + area.r1) / 2, (area.a0 + area.a1) / 2), width: 0, height: 0 };
  let bestArea = 0;
  for (let i = 1; i <= 5; i++) {
    for (let j = 1; j <= 5; j++) {
      const a = area.a0 + ((area.a1 - area.a0) * i) / 6;
      const r = area.r0 + ((area.r1 - area.r0) * j) / 6;
      const c = full && slot.r0 < 1e-3 ? at(box, 0, 0) : at(box, r, a);
      for (const aspect of [2.4, 1.6, 1.1]) {
        let low = 0;
        let high = Math.min(box.rx, box.ry) * 2;
        for (let k = 0; k < 8; k++) {
          const h = (low + high) / 2;
          if (rectFits(c.x, c.y, h * aspect, h, polygon)) low = h;
          else high = h;
        }
        // Prefer shapes wide enough to hold a line of text.
        const width = low * aspect;
        const score = low * width * (width >= 110 ? 1 : 0.6);
        if (score > bestArea) {
          bestArea = score;
          best = { x: c.x, y: c.y, width, height: low };
        }
      }
    }
  }
  return best;
}
