"use client";

import Link from "next/link";
import { useRef, type PointerEvent, type ReactNode } from "react";

const MAX_TILT = 3; // degrees

/** A link card that tilts toward the mouse pointer. Touch and reduced-motion users get a flat card. */
export function TiltCard({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  function onMove(e: PointerEvent<HTMLAnchorElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width; // 0..1
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - y) * MAX_TILT}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * MAX_TILT}deg`);
    el.style.setProperty("--gx", `${x * 100}%`);
    el.style.setProperty("--gy", `${y * 100}%`);
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <Link
      ref={ref}
      href={href}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`tilt-card ${className}`}
    >
      {children}
      <span aria-hidden className="tilt-glare" />
    </Link>
  );
}
