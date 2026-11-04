"use client";

import { Children, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Layout = { cols: number; rows: number; scroll: boolean };

const GAP = 14; // px between cards
const ASPECT = 1.35; // preferred card width / height
const MIN_ROW = 130; // below this a card is unreadable, so the grid scrolls instead

/**
 * Pick the column count that gives every card the largest size, given the
 * space available. With n cards in a W x H box, each column count c gives
 * ceil(n / c) rows; the best c is the one whose cells hold the biggest card
 * of roughly ASPECT proportions.
 */
function fit(n: number, width: number, height: number): Layout {
  if (n === 0 || width === 0 || height === 0) return { cols: 1, rows: 1, scroll: false };

  let best = { cols: 1, rows: n, score: -Infinity };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const w = (width - GAP * (cols - 1)) / cols;
    const h = (height - GAP * (rows - 1)) / rows;
    // Biggest ASPECT-shaped card that fits the cell; small tie-break against empty slots.
    const score = Math.min(w, h * ASPECT) - (rows * cols - n);
    if (score > best.score) best = { cols, rows, score };
  }

  const rowHeight = (height - GAP * (best.rows - 1)) / best.rows;
  if (rowHeight >= MIN_ROW) return { cols: best.cols, rows: best.rows, scroll: false };

  // Too many cards to fit legibly: keep a minimum size and scroll the grid.
  const cols = Math.max(1, Math.floor((width + GAP) / (MIN_ROW * ASPECT + GAP)));
  return { cols, rows: Math.ceil(n / cols), scroll: true };
}

/** A grid whose cards always fill the available space, without page scrolling. */
export function FitGrid({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const n = items.length;
  const ref = useRef<HTMLDivElement>(null);
  // First paint guess before the box is measured.
  const [layout, setLayout] = useState<Layout>(() => {
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    return { cols, rows: Math.max(1, Math.ceil(n / cols)), scroll: false };
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setLayout(fit(n, width, height));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [n]);

  return (
    <div ref={ref} className={`h-full min-h-0 ${layout.scroll ? "overflow-y-auto" : ""}`}>
      <div
        className={`grid ${layout.scroll ? "" : "h-full"}`}
        style={{
          gap: GAP,
          gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
          ...(layout.scroll
            ? { gridAutoRows: MIN_ROW }
            : { gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))` }),
        }}
      >
        {items}
      </div>
    </div>
  );
}
