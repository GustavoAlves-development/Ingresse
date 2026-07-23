import { Resend } from "resend";
import { TicketEmail } from "./TicketEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendTicketEmail(params: {
  buyerEmail: string;
  buyerName: string;
  eventName: string;
  eventLocation: string;
  eventStartsAt: Date;
  qrCodeDataUrl: string;
}) {
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
