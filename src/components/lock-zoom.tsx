"use client";

import { useEffect } from "react";

/** Safari can ignore the viewport's no-zoom setting, so cancel its pinch gesture too. */
export function LockZoom() {
  useEffect(() => {
    const cancel = (event: Event) => event.preventDefault();
    const gestures = ["gesturestart", "gesturechange", "gestureend"];
    for (const name of gestures) document.addEventListener(name, cancel, { passive: false });
    return () => {
      for (const name of gestures) document.removeEventListener(name, cancel);
    };
  }, []);
  return null;
}
