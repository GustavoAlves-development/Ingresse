import { NextResponse } from "next/server";
import { buildDailyReport } from "@/lib/billing/dailyReport";
import { debugLog } from "@/lib/debug/debugLog";
import { listOrganizersByIds } from "@/lib/db/organizerRepository";
import { listPaidOrdersInRange } from "@/lib/db/orderRepository";
import { sendDailyReportEmail } from "@/lib/email/sendDailyReportEmail";
import {
  formatSaoPauloDateLabel,
  getSaoPauloDayRangeUntilNow,
} from "@/lib/format/saoPauloDate";

// Disparado pelo Vercel Cron (ver vercel.json — "0 1 * * *" em UTC = 22h em
// Brasília) todo dia. Protegido por CRON_SECRET: a Vercel manda esse
// segredo automaticamente no header Authorization quando a rota é chamada
// pelo cron configurado; sem a env var configurada, a rota recusa qualquer
// chamada — ninguém de fora consegue disparar o relatório.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const { start, end } = getSaoPauloDayRangeUntilNow(now);
    const dateLabel = formatSaoPauloDateLabel(now);

    const orders = await listPaidOrdersInRange(start, end);
    const organizerIds = Array.from(
      new Set<string>(
        orders.map((order: { organizerId: string }) => order.organizerId),
      ),
    );
    const organizers = await listOrganizersByIds(organizerIds);

    const report = buildDailyReport(orders, organizers, dateLabel);

    await sendDailyReportEmail(report);

    console.log("[cron daily-report] relatório enviado", {
      dateLabel,
      organizerCount: report.organizers.length,
      totalGrossCents: report.totals.grossCents,
      totalProfitCents: report.totals.platformFeeCents,
    });
    await debugLog("relatório diário enviado", {
      dateLabel,
      organizerCount: report.organizers.length,
      totalGrossCents: report.totals.grossCents,
      totalProfitCents: report.totals.platformFeeCents,
    });

    return NextResponse.json({
      ok: true,
      dateLabel,
      organizerCount: report.organizers.length,
    });
  } catch (err) {
    console.error("[cron daily-report] erro ao gerar/enviar relatório", err);
    await debugLog("relatório diário: erro", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
