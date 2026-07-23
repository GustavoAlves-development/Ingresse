import { Resend } from "resend";
import { TicketEmail } from "./TicketEmail";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada");
  }
  resendClient ??= new Resend(apiKey);
  return resendClient;
}

export async function sendTicketEmail(params: {
  buyerEmail: string;
  buyerName: string;
  eventName: string;
  eventLocation: string;
  eventStartsAt: Date;
  qrCodeDataUrl: string;
}) {
  const resend = getResendClient();

  const { error } = await resend.emails.send({
    from: "Plataforma de Ingressos <ingressos@resend.dev>",
    to: params.buyerEmail,
    subject: `Seu ingresso para ${params.eventName}`,
    react: (
      <TicketEmail
        buyerName={params.buyerName}
        eventName={params.eventName}
        eventLocation={params.eventLocation}
        eventStartsAt={params.eventStartsAt}
        qrCodeDataUrl={params.qrCodeDataUrl}
      />
    ),
  });

  if (error) {
    throw new Error(`Falha ao enviar e-mail do ingresso: ${error.message}`);
  }
}
