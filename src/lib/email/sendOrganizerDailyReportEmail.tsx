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

  const subject = `📊 Resumo do dia (${dateLabel}) — você ganhou ${formatBRLFromCents(line.netCents)}`;

  const { error } = await resend.emails.send({
    from: "Plataforma de Ingressos <ingressos@ingressebr.site>",
    to: line.organizerEmail,
    subject,
    react: <OrganizerDailyReportEmail line={line} dateLabel={dateLabel} />,
  });

  if (error) {
    throw new Error(
      `Falha ao enviar resumo diário do organizador: ${error.message}`,
    );
  }
}
