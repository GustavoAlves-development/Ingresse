import { NextResponse } from "next/server";
import { findEventById } from "@/lib/db/eventRepository";
import { markOrderAsPaidAndCreateTickets } from "@/lib/db/orderRepository";
import { sendTicketEmail } from "@/lib/email/sendTicketEmail";
import { fetchPayment } from "@/lib/payments/mercadoPago";
import { verifyMercadoPagoSignature } from "@/lib/payments/verifyWebhookSignature";
import { generateQrCodeDataUrl } from "@/lib/tickets/qrCode";

export async function POST(request: Request) {
  const xSignature = request.headers.get("x-signature") ?? "";
  const xRequestId = request.headers.get("x-request-id") ?? "";
  const body = await request.json();

  const dataId = body?.data?.id;
  if (!dataId) {
    return NextResponse.json({ error: "missing data.id" }, { status: 400 });
  }

  const signatureValid = verifyMercadoPagoSignature({
    xSignature,
    xRequestId,
    dataId: String(dataId),
    webhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "",
  });

  if (!signatureValid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const payment = await fetchPayment(String(dataId));

  if (payment.status !== "approved") {
    return NextResponse.json({ received: true });
  }

  const orderId = payment.external_reference;
  if (!orderId) {
    return NextResponse.json(
      { error: "missing external_reference" },
      { status: 400 },
    );
  }

  const result = await markOrderAsPaidAndCreateTickets({
    orderId,
    mercadoPagoPaymentId: String(dataId),
  });

  if (!result.alreadyProcessed) {
    const event = await findEventById(result.order.eventId);
    if (event) {
      for (const ticket of result.tickets) {
        const qrCodeDataUrl = await generateQrCodeDataUrl(ticket.qrToken);
        await sendTicketEmail({
          buyerEmail: result.order.buyerEmail,
          buyerName: ticket.buyerName,
          eventName: event.name,
          eventLocation: event.location,
          eventStartsAt: event.startsAt,
          qrCodeDataUrl,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
