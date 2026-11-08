"use client";

import { useEffect } from "react";

/** Registers the service worker in production so Nova can be installed. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not fatal: Nova works fine without it, it just can't show the offline screen.
    });
  }, []);
  return null;
}
