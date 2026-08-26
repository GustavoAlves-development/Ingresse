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

// Manda um único e-mail com todos os ingressos do pedido, mesmo quando o
// comprador levou mais de uma unidade — antes cada ticket virava um e-mail
// separado, o que gastava cota do Resend à toa e lotava a caixa de entrada
// do comprador com N e-mails idênticos.
export async function sendTicketEmail(params: {
  buyerEmail: string;
  buyerName: string;
  eventName: string;
  eventLocation: string;
  eventStartsAt: Date;
  tickets: {
    ticketId: string;
    buyerName: string;
    qrCodeUrl: string;
  }[];
}) {
  const resend = getResendClient();

  const tickets = params.tickets.map((ticket) => ({
    qrCodeUrl: ticket.qrCodeUrl,
    buyerName: ticket.buyerName,
    // Código curto e legível pra digitar/ler em voz alta na portaria caso a
    // imagem do QR não carregue no cliente de e-mail do comprador. Não é
    // usado pra validar entrada (isso continua sendo só o qrToken) — é só
    // uma referência pra equipe localizar o ticket manualmente se precisar.
    ticketCode: ticket.ticketId.slice(0, 8).toUpperCase(),
  }));

  const subject =
    tickets.length > 1
      ? `Seus ${tickets.length} ingressos para ${params.eventName}`
      : `Seu ingresso para ${params.eventName}`;

  const { error } = await resend.emails.send({
    from: "Plataforma de Ingressos <ingressos@ingressebr.site>",
    to: params.buyerEmail,
    subject,
    react: (
      <TicketEmail
        buyerName={params.buyerName}
        eventName={params.eventName}
        eventLocation={params.eventLocation}
        eventStartsAt={params.eventStartsAt}
        tickets={tickets}
      />
    ),
  });

  if (error) {
    throw new Error(`Falha ao enviar e-mail do ingresso: ${error.message}`);
  }
}
