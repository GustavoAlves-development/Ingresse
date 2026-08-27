import { z } from "zod";
import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/auth/password";
import {
  findUserByValidResetToken,
  resetPassword,
} from "@/lib/db/userRepository";
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

const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
  });

async function resetPasswordAction(formData: FormData) {
  "use server";

  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  const token = formData.get("token");
  const tokenParam = typeof token === "string" ? `&token=${token}` : "";

  if (!parsed.success) {
    redirect(`/reset-password?error=1${tokenParam}`);
  }

  const user = await findUserByValidResetToken(parsed.data.token);
  if (!user) {
    redirect("/reset-password?error=expired");
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await resetPassword(user.id, passwordHash);

  redirect("/login?reset=1");
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">Link inválido</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                Esse link de redefinição de senha está incompleto. Peça um
                novo em &quot;Esqueci a senha&quot;.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Confirma que o token é válido ANTES de mostrar o formulário — evita a
  // pessoa preencher tudo pra só então descobrir que o link expirou.
  const user = error === "expired" ? null : await findUserByValidResetToken(token);
  const isExpiredOrInvalid = error === "expired" || (!user && !error);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Redefinir senha</CardTitle>
          <CardDescription>Escolha uma nova senha pra sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          {isExpiredOrInvalid ? (
            <Alert variant="destructive">
              <AlertDescription>
                Esse link expirou ou já foi usado. Peça um novo em
                &quot;Esqueci a senha&quot;.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {error === "1" && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>
                    Verifique os campos — a senha precisa ter pelo menos 8
                    caracteres e as duas devem ser iguais.
                  </AlertDescription>
                </Alert>
              )}
              <form action={resetPasswordAction}>
                <FieldGroup>
                  <input type="hidden" name="token" value={token} />
                  <Field>
                    <FieldLabel htmlFor="password">Nova senha</FieldLabel>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      minLength={8}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirmPassword">
                      Confirme a nova senha
                    </FieldLabel>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      minLength={8}
                      required
                    />
                  </Field>
                  <Button type="submit" className="w-full">
                    Redefinir senha
                  </Button>
                </FieldGroup>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
