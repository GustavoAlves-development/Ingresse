import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

async function loginAction(formData: FormData) {
  "use server";

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form action={loginAction} className="flex w-80 flex-col gap-4">
        <h1 className="text-xl font-semibold">Entrar</h1>
        {error && (
          <p className="text-sm text-red-500">E-mail ou senha inválidos.</p>
        )}
        <input
          name="email"
          type="email"
          placeholder="E-mail"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Senha"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-2 text-white"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
