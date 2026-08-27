import { Resend } from "resend";
import type { OrganizerReportLine } from "@/lib/billing/dailyReport";
import { OrganizerDailyReportEmail } from "./OrganizerDailyReportEmail";
import { formatBRLFromCents } from "@/lib/format/currency";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada");
  }
  resendClient ??= new Resend(apiKey);
  return resendClient;
}

// Manda direto pro e-mail do organizador (Organizer.email) — nunca mostra
// valor bruto, taxa da plataforma nem qualquer coisa relacionada à
// comissão. Só o que ele realmente recebe (netCents) e quantos ingressos
// vendeu. Ver src/lib/billing/dailyReport.ts pra como esses números são
// calculados (mesma base do relatório interno, só que sem expor a parte
// da plataforma).
export async function sendOrganizerDailyReportEmail(
  line: OrganizerReportLine,
  dateLabel: string,
) {
  if (!line.organizerEmail) {
    throw new Error(
      `Organizador ${line.organizerName} (${line.organizerId}) sem e-mail cadastrado`,
    );
  }

  const resend = getResendClient();

  // Assunto sem valor em R$ e sem emoji — "você ganhou R$ X" + emoji de
  // dinheiro no assunto é um padrão clássico de filtro de spam financeiro.
  // O valor continua bem visível assim que abre o e-mail.
  const subject = `Resumo de vendas de ${dateLabel} — Ingresse`;

  const eventsSummary = line.events
    .map((ev) => `- ${ev.eventName}: ${ev.quantity}x`)
    .join("\n");

  // Versão em texto puro, sem HTML — e-mails só-HTML são penalizados pelos
  // filtros de spam do Gmail/Resend (ver Resend Deliverability Insights).
  const text = [
    `Olá, ${line.organizerName}!`,
    "",
    `Resumo do dia ${dateLabel}:`,
    `Você ganhou: ${formatBRLFromCents(line.netCents)}`,
    `Ingressos vendidos: ${line.ticketsSold}`,
    ...(line.events.length > 1 ? ["", eventsSummary] : []),
  ].join("\n");

  const { error } = await resend.emails.send({
    from: "Plataforma de Ingressos <ingressos@ingressebr.site>",
    to: line.organizerEmail,
    subject,
    text,
    react: <OrganizerDailyReportEmail line={line} dateLabel={dateLabel} />,
  });

  if (error) {
    throw new Error(
      `Falha ao enviar resumo diário do organizador: ${error.message}`,
    );
  }
}
