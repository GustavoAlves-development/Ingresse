import { Prisma } from "@prisma/client";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/auth";
import { hashPassword } from "@/lib/auth/password";
import { createOrganizerWithAdminUser } from "@/lib/db/organizerRepository";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Criar conta de organizador</CardTitle>
          <CardDescription>
            Comece a vender ingressos para o seu evento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error === "invalid-input" && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Preencha todos os campos corretamente.
              </AlertDescription>
            </Alert>
          )}
          {error && error !== "invalid-input" && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Não foi possível criar a conta. Tente outro e-mail.
              </AlertDescription>
            </Alert>
          )}
          <form action={signupAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="organizerName">
                  Nome da organização
                </FieldLabel>
                <Input id="organizerName" name="organizerName" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="adminName">Seu nome</FieldLabel>
                <Input id="adminName" name="adminName" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input id="email" name="email" type="email" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Senha</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                />
              </Field>
              <Button type="submit">Criar conta</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
