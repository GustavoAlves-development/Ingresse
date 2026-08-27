import { Resend } from "resend";
import { PasswordResetEmail } from "./PasswordResetEmail";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada");
  }
  resendClient ??= new Resend(apiKey);
  return resendClient;
}

export async function sendPasswordResetEmail(params: {
  toEmail: string;
  userName: string;
  resetUrl: string;
}) {
  const resend = getResendClient();

  const text = [
    `Olá, ${params.userName}.`,
    "",
    "Recebemos um pedido pra redefinir a senha da sua conta na Plataforma de Ingressos.",
    "Abra este link pra escolher uma nova senha (válido por 1 hora):",
    params.resetUrl,
    "",
    "Se você não pediu essa redefinição, pode ignorar este e-mail.",
  ].join("\n");

  const { error } = await resend.emails.send({
    from: "Plataforma de Ingressos <ingressos@ingressebr.site>",
    to: params.toEmail,
    subject: "Redefinir sua senha — Plataforma de Ingressos",
    text,
    react: (
      <PasswordResetEmail userName={params.userName} resetUrl={params.resetUrl} />
    ),
  });

  if (error) {
    throw new Error(`Falha ao enviar e-mail de redefinição de senha: ${error.message}`);
  }
}
