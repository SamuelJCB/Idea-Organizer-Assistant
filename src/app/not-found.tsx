import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="text-sm text-muted">That project doesn&apos;t exist, or it isn&apos;t yours.</p>
      <Link href="/" className="btn-secondary self-start">
        All projects
      </Link>
    </main>
  );
}
