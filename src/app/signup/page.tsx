import { Prisma } from "@prisma/client";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/auth";
import { hashPassword } from "@/lib/auth/password";
import { createOrganizerWithAdminUser } from "@/lib/db/organizerRepository";

const signupSchema = z.object({
  organizerName: z.string().min(1),
  adminName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

async function signupAction(formData: FormData) {
  "use server";

  const parsed = signupSchema.safeParse({
    organizerName: formData.get("organizerName"),
    adminName: formData.get("adminName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/signup?error=invalid-input");
  }

  const { organizerName, adminName, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    await createOrganizerWithAdminUser({
      organizerName,
      organizerEmail: email,
      adminName,
      adminEmail: email,
      passwordHash,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirect("/signup?error=email-in-use");
    }
    throw error;
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/admin" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw error;
  }
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form action={signupAction} className="flex w-80 flex-col gap-4">
        <h1 className="text-xl font-semibold">Criar conta de organizador</h1>
        {error === "invalid-input" && (
          <p className="text-sm text-red-500">
            Preencha todos os campos corretamente.
          </p>
        )}
        {error && error !== "invalid-input" && (
          <p className="text-sm text-red-500">
            Não foi possível criar a conta. Tente outro e-mail.
          </p>
        )}
        <input
          name="organizerName"
          placeholder="Nome da organização"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="adminName"
          placeholder="Seu nome"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
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
          minLength={8}
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-2 text-white"
        >
          Criar conta
        </button>
      </form>
    </main>
  );
}
