import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { LockZoom } from "@/components/lock-zoom";
import { RegisterServiceWorker } from "@/components/register-sw";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nova",
  description: "Capture, organize, and move projects forward.",
  // Home-screen app on iPhone/iPad: full screen, named "Nova".
  appleWebApp: { capable: true, title: "Nova", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#efeeeb",
  colorScheme: "only light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex h-full flex-col font-sans">
        {/* Longer pages, like a project's details, scroll here. The home screen fits exactly. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">{children}</div>
        <LockZoom />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
