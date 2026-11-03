"use client";

import Link from "next/link";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted">{error.message || "An unexpected error occurred."}</p>
      <div className="flex gap-3">
        <button type="button" onClick={() => retry()} className="btn-primary">
          Try again
        </button>
        <Link href="/" className="btn-secondary">
          Home
        </Link>
      </div>
    </main>
  );
}
