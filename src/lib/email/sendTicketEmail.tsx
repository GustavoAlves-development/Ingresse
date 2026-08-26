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
  qrCodeUrl: string;
  ticketId: string;
}) {
  const resend = getResendClient();

  // Código curto e legível pra digitar/ler em voz alta na portaria caso a
  // imagem do QR não carregue no cliente de e-mail do comprador. Não é
  // usado pra validar entrada (isso continua sendo só o qrToken) — é só
  // uma referência pra equipe localizar o ticket manualmente se precisar.
  const ticketCode = params.ticketId.slice(0, 8).toUpperCase();

  const { error } = await resend.emails.send({
    from: "Plataforma de Ingressos <ingressos@ingressebr.site>",
    to: params.buyerEmail,
    subject: `Seu ingresso para ${params.eventName}`,
    react: (
      <TicketEmail
        buyerName={params.buyerName}
        eventName={params.eventName}
        eventLocation={params.eventLocation}
        eventStartsAt={params.eventStartsAt}
        qrCodeUrl={params.qrCodeUrl}
        ticketCode={ticketCode}
      />
    ),
  });

  if (error) {
    throw new Error(`Falha ao enviar e-mail do ingresso: ${error.message}`);
  }
}
