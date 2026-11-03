import { STALE_DAYS, LIVE_STATUSES, type Project } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;

export function daysSince(iso: string, now: number): number {
  return Math.floor((now - new Date(iso).getTime()) / DAY);
}

/** Short, phone-friendly age: "today", "3d ago", "2w ago", "5mo ago". */
export function ageLabel(iso: string, now: number): string {
  const days = daysSince(iso, now);
  if (days < 1) return "today";
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Flag live projects that have gone quiet. Parked/done/killed are quiet on purpose. */
export function isStale(project: Pick<Project, "status" | "last_touched">, now: number): boolean {
  return LIVE_STATUSES.includes(project.status) && daysSince(project.last_touched, now) >= STALE_DAYS;
}
