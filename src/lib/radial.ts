/**
 * Geometry for the dashboard board: one soft hexagon cut into an inner ring of
 * wedges that meet at the center and an outer ring of blocks.
 * Radii are fractions of the board (0 = center, 1 = edge).
 */

export const INNER_RADIUS = 0.62;
const START = -Math.PI / 2;
const TAU = Math.PI * 2;
const MAX_STRETCH = 1.6;
const GAP = 5;
const CORNER = 34;
/** Skip hexagon corners this close to a cut, which would make tiny edges. */
const CORNER_SKIP = 0.04;
const LABEL_PADDING = 14;

export type Ring = "inner" | "outer";
export type Slot = { a0: number; a1: number; r0: number; r1: number };
export type Box = { cx: number; cy: number; rx: number; ry: number };
export type Label = { x: number; y: number; width: number; height: number };
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

/** A piece's outline. Every point is a corner to round. */
function outline(slot: Slot, box: Box) {
  const { a0, a1, r0, r1 } = slot;
  const outer = arc(box, r1, a0, a1);
  return r0 < 1e-3 ? [at(box, 0, a0), ...outer] : [...outer, ...arc(box, r0, a1, a0)];
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

function softPath(points: Point[]) {
  return roundedPath(points, points.map((_, i) => i));
}

/** SVG path for a slot. A full outer ring has a hole, so use fill-rule="evenodd". */
export function slotPath(slot: Slot, box: Box) {
  const { a0, a1, r0, r1 } = slot;
  if (a1 - a0 > TAU - 1e-3) {
    const outer = softPath(inset(arc(box, r1, a0, a1, true), GAP));
    if (r0 < 1e-3) return outer;
    return outer + softPath(inset(arc(box, r0, a0, a1, true), -GAP));
  }
  return softPath(inset(outline(slot, box), GAP));
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

/** The balance point of a shape. */
function centroid(points: Point[]): Point {
  const area = signedArea(points) || 1;
  let x = 0;
  let y = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    const cross = p.x * q.y - q.x * p.y;
    x += (p.x + q.x) * cross;
    y += (p.y + q.y) * cross;
  });
  return { x: x / (3 * area), y: y / (3 * area) };
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
      ? arc(box, slot.r1, slot.a0, slot.a1, true)
      : outline(area, box);
  const polygon = inset(raw, GAP + LABEL_PADDING);
  const middle = centroid(polygon);
  const scale = Math.sqrt(Math.abs(signedArea(polygon)) / 2) || 1;

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
        // Text near the middle of the piece looks balanced, so off-center spots score lower.
        const offCenter = Math.hypot(c.x - middle.x, c.y - middle.y) / scale;
        const score = low * width * (width >= 110 ? 1 : 0.6) * Math.max(0.2, 1 - offCenter * 1.0);
        if (score > bestArea) {
          bestArea = score;
          best = { x: c.x, y: c.y, width, height: low };
        }
      }
    }
  }
  return best;
}
