/**
 * Geometry for the dashboard board: one rounded shape cut into an inner ring
 * of wedges that meet at the center and an outer ring of blocks.
 * Radii are fractions of the board (0 = center, 1 = edge).
 */

export const INNER_RADIUS = 0.5;
const START = -Math.PI / 2;
const TAU = Math.PI * 2;
const MAX_STRETCH = 1.6;
const GAP = 5;
const CORNER = 14;
/** Skip hexagon corners this close to a cut, which would make tiny edges. */
const CORNER_SKIP = 0.04;

export type Ring = "inner" | "outer";
export type Slot = { a0: number; a1: number; r0: number; r1: number };
export type Box = { cx: number; cy: number; rx: number; ry: number };
type Point = { x: number; y: number };

export function boardBox(width: number, height: number): Box {
  // The hexagon's flat top sits at cos(30°) of its radius; scale so it reaches the edges.
  const ry = Math.max(height / 2 - 2, 1) / Math.cos(Math.PI / 6);
  const rx = Math.min(Math.max(width / 2 - 2, 1), ry * MAX_STRETCH);
  return { cx: width / 2, cy: height / 2, rx, ry };
}

/** Evenly divides a ring, with the first piece centered at the top. */
export function ringSlots(count: number, ring: Ring): Slot[] {
  const span = TAU / Math.max(count, 1);
  const [r0, r1] = ring === "inner" ? [0, INNER_RADIUS] : [INNER_RADIUS, 1];
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
  const ring: Ring = Math.hypot(dx, dy) / hexReach(Math.atan2(dy, dx)) < INNER_RADIUS ? "inner" : "outer";
  const cells = otherCount(ring) + 1;
  const span = TAU / cells;
  const from = START - span / 2;
  const turned = (((Math.atan2(dy, dx) - from) % TAU) + TAU) % TAU;
  return { ring, index: Math.min(Math.floor(turned / span), cells - 1) };
}

/** Distance from the center to a flat-topped hexagon at angle `a`, with corners at 1. */
function hexReach(a: number) {
  const side = Math.PI / 3;
  const turned = ((a % side) + side) % side;
  return Math.cos(side / 2) / Math.cos(turned - side / 2);
}

function at(box: Box, r: number, a: number): Point {
  const reach = r * hexReach(a);
  return { x: box.cx + reach * box.rx * Math.cos(a), y: box.cy + reach * box.ry * Math.sin(a) };
}

/** Hexagon corners strictly between two angles, in travel order. */
function cornersBetween(a0: number, a1: number) {
  const side = Math.PI / 3;
  const [low, high] = a0 < a1 ? [a0, a1] : [a1, a0];
  const corners: number[] = [];
  for (let k = Math.ceil((low + CORNER_SKIP) / side); k * side < high - CORNER_SKIP; k++) {
    corners.push(k * side);
  }
  return a0 < a1 ? corners : corners.reverse();
}

/** Points along a ring edge. Both rings trace the same hexagon, so they always line up. */
function arc(box: Box, r: number, a0: number, a1: number, closed = false) {
  const angles = [a0, ...cornersBetween(a0, a1), ...(closed ? [] : [a1])];
  return angles.map((a) => at(box, r, a));
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

function rounded(points: Point[], corner: number) {
  const n = (v: number) => v.toFixed(1);
  const parts = points.map((p, i) => {
    const prev = points[(i - 1 + points.length) % points.length];
    const next = points[(i + 1) % points.length];
    const inLen = Math.hypot(p.x - prev.x, p.y - prev.y) || 1;
    const outLen = Math.hypot(next.x - p.x, next.y - p.y) || 1;
    const t1 = Math.min(corner, inLen / 2.4) / inLen;
    const t2 = Math.min(corner, outLen / 2.4) / outLen;
    const a = { x: p.x + (prev.x - p.x) * t1, y: p.y + (prev.y - p.y) * t1 };
    const b = { x: p.x + (next.x - p.x) * t2, y: p.y + (next.y - p.y) * t2 };
    return `${i === 0 ? "M" : "L"}${n(a.x)} ${n(a.y)}Q${n(p.x)} ${n(p.y)} ${n(b.x)} ${n(b.y)}`;
  });
  return `${parts.join("")}Z`;
}

/** SVG path for a slot. A full outer ring has a hole, so use fill-rule="evenodd". */
export function slotPath(slot: Slot, box: Box) {
  const { a0, a1, r0, r1 } = slot;
  const full = a1 - a0 > TAU - 1e-3;
  if (full) {
    const outer = rounded(inset(arc(box, r1, a0, a1, true), GAP), CORNER);
    if (r0 < 1e-3) return outer;
    return outer + rounded(inset(arc(box, r0, a0, a1, true), -GAP), CORNER);
  }
  const edge = arc(box, r1, a0, a1);
  const points =
    r0 < 1e-3 ? [at(box, 0, a0), ...edge] : [...edge, ...arc(box, r0, a1, a0)];
  return rounded(inset(points, GAP), CORNER);
}

/** Where a slot's text goes, sized to what fits inside the piece. */
export function labelBox(slot: Slot, box: Box) {
  const span = slot.a1 - slot.a0;
  const full = span > TAU - 1e-3;
  const a = full ? START : (slot.a0 + slot.a1) / 2;
  const r = full && slot.r0 < 1e-3 ? 0 : slot.r0 < 1e-3 ? slot.r1 * 0.64 : (slot.r0 + slot.r1) / 2;
  const center = at(box, r, a);
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const radial = (slot.r1 - slot.r0) * hexReach(a) * Math.hypot(box.rx * c, box.ry * s) * (slot.r0 < 1e-3 ? 0.62 : 1);
  const p = at(box, r || slot.r1, a - Math.min(span, Math.PI) / 2);
  const q = at(box, r || slot.r1, a + Math.min(span, Math.PI) / 2);
  const chord = Math.hypot(p.x - q.x, p.y - q.y);
  return {
    x: center.x,
    y: center.y,
    width: Math.max((chord * s + radial * c) * 0.74, 44),
    height: Math.max((chord * c + radial * s) * 0.62, 24),
  };
}
