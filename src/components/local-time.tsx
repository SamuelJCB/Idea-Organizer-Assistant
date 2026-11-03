"use client";

/**
 * Formats a timestamp in the viewer's own time zone. The server runs in UTC,
 * so the first paint may differ briefly; the browser then shows local time.
 */
export function LocalTime({ iso }: { iso: string }) {
  const formatted = new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {formatted}
    </time>
  );
}
