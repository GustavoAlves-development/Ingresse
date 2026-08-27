import { Resend } from "resend";
import type { DailyReport } from "@/lib/billing/dailyReport";
import { DailyReportEmail } from "./DailyReportEmail";
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

// Manda pra você mesmo, dono da plataforma — não pro organizador. Dá pra
// trocar sem redeploy configurando PLATFORM_REPORT_EMAIL na Vercel; se não
// tiver configurada, cai nesse e-mail fixo.
const DEFAULT_REPORT_RECIPIENT = "alfamixltdabr@gmail.com";

export async function sendDailyReportEmail(report: DailyReport) {
  const resend = getResendClient();
  const recipient =
    process.env.PLATFORM_REPORT_EMAIL ?? DEFAULT_REPORT_RECIPIENT;

  // Assunto bem chamativo e informativo de propósito — pra você bater o
  // olho na caixa de entrada e já saber do que se trata sem precisar
  // abrir, e não confundir com nenhum outro e-mail do sistema (que usam
  // o emoji 🎟️ e falam de "ingresso", não de "fechamento"/"lucro").
  const hasSales = report.organizers.length > 0;
  const realProfitCents =
    report.totals.platformFeeCents - report.totals.mercadoPagoFeeCents;
  const subject = hasSales
    ? `💰🧾 FECHAMENTO DO DIA (${report.dateLabel}) — seu lucro líquido: ${formatBRLFromCents(realProfitCents)}`
    : `💰🧾 FECHAMENTO DO DIA (${report.dateLabel}) — sem vendas hoje`;

  const { error } = await resend.emails.send({
    from: "Ingresse — Fechamento 💰 <relatorios@ingressebr.site>",
    to: recipient,
    subject,
    text: buildPlainTextReport(report, realProfitCents),
    react: <DailyReportEmail report={report} />,
  });

  if (error) {
    throw new Error(`Falha ao enviar relatório diário: ${error.message}`);
  }
}

// Versão em texto puro, sem HTML — e-mails só-HTML são penalizados pelos
// filtros de spam do Gmail/Resend (ver Resend Deliverability Insights).
function buildPlainTextReport(report: DailyReport, realProfitCents: number): string {
  if (report.organizers.length === 0) {
    return `Fechamento do dia — ${report.dateLabel}\n\nNenhuma venda paga registrada hoje.`;
  }

  const lines = [
    `Fechamento do dia — ${report.dateLabel}`,
    "",
    `Total vendido: ${formatBRLFromCents(report.totals.grossCents)} (${report.totals.ticketsSold} ingressos)`,
    `Sua comissão (10%): ${formatBRLFromCents(report.totals.platformFeeCents)}`,
    `Foi pro Mercado Pago: ${formatBRLFromCents(report.totals.mercadoPagoFeeCents)}`,
    `Seu lucro líquido real: ${formatBRLFromCents(realProfitCents)}`,
    `A repassar aos organizadores: ${formatBRLFromCents(report.totals.netCents)}`,
    "",
    "Por organizador:",
    ...report.organizers.map(
      (org) =>
        `- ${org.organizerName} (${org.organizerEmail}): vendeu ${formatBRLFromCents(org.grossCents)}, você repassa ${formatBRLFromCents(org.netCents)}`,
    ),
  ];

  return lines.join("\n");
}
