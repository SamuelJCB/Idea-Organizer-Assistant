import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { PasskeyLogin } from "./passkey-login";

export const metadata = { title: "Sign in · Nova" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Nova</h1>
      <p className="mt-1 mb-8 text-sm text-muted">Sign in to continue.</p>
      <Suspense fallback={<LoginForm linkFailed={false} />}>
        <FormWithError searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function FormWithError({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error, signedout } = await searchParams;
  return (
    <>
      <PasskeyLogin autoPrompt={!signedout} />
      <LoginForm linkFailed={Boolean(error)} />
    </>
  );
}
