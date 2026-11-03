import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Project Hub" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Project Hub</h1>
      <p className="mt-1 mb-8 text-sm text-muted">We&apos;ll email you a link to sign in.</p>
      <Suspense fallback={<LoginForm linkFailed={false} />}>
        <FormWithError searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function FormWithError({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  return <LoginForm linkFailed={Boolean(error)} />;
}
