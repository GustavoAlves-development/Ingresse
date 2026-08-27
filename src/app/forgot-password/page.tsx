import { z } from "zod";
import { redirect } from "next/navigation";
import { findUserByEmail, setPasswordResetToken } from "@/lib/db/userRepository";
import {
  generatePasswordResetToken,
  getPasswordResetExpiry,
} from "@/lib/auth/passwordResetToken";
import { sendPasswordResetEmail } from "@/lib/email/sendPasswordResetEmail";
import { getAppUrl } from "@/lib/env/appUrl";
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

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

async function forgotPasswordAction(formData: FormData) {
  "use server";

  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  // Mesma resposta (redirect pra ?sent=1) tanto se o e-mail existe quanto
  // se não existe — nunca revelamos se um e-mail está cadastrado ou não
  // por essa tela, senão vira uma forma de descobrir e-mails válidos.
  if (!parsed.success) {
    redirect("/forgot-password?sent=1");
  }

  const user = await findUserByEmail(parsed.data.email);
  if (user) {
    const token = generatePasswordResetToken();
    const expiresAt = getPasswordResetExpiry();
    await setPasswordResetToken(user.id, token, expiresAt);

    const resetUrl = `${getAppUrl()}/reset-password?token=${token}`;
    try {
      await sendPasswordResetEmail({
        toEmail: user.email,
        userName: user.name,
        resetUrl,
      });
    } catch (err) {
      // Não deixamos uma falha de envio revelar nada de diferente pro
      // usuário nem travar o fluxo — só registramos no log do servidor.
      console.error("[forgot-password] falha ao enviar e-mail", err);
    }
  }

  redirect("/forgot-password?sent=1");
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Esqueci a senha</CardTitle>
          <CardDescription>
            Informe seu e-mail de login e mandamos um link pra redefinir a
            senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent && (
            <Alert className="mb-4 border-success/30 bg-success/10">
              <AlertDescription className="text-success">
                Se esse e-mail estiver cadastrado, um link de redefinição foi
                enviado. Confira sua caixa de entrada (e o spam).
              </AlertDescription>
            </Alert>
          )}
          <form action={forgotPasswordAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input id="email" name="email" type="email" required />
              </Field>
              <Button type="submit" className="w-full">
                Enviar link de redefinição
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
