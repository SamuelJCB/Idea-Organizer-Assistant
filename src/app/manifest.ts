import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nova",
    short_name: "Nova",
    description: "Capture, organize, and move projects forward.",
    id: "/",
    start_url: "/",
    scope: "/",
    // Opens as its own window, with no browser tabs or address bar.
    display: "standalone",
    orientation: "any",
    background_color: "#efeeeb",
    theme_color: "#efeeeb",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
