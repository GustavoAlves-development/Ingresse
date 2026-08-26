import { NextResponse } from "next/server";
import { debugLog } from "@/lib/debug/debugLog";
import { findEventById } from "@/lib/db/eventRepository";
import { findOrderById, markOrderAsPaidAndCreateTickets } from "@/lib/db/orderRepository";
import { sendTicketEmail } from "@/lib/email/sendTicketEmail";
import { fetchPayment } from "@/lib/payments/mercadoPago";
import { verifyMercadoPagoSignature } from "@/lib/payments/verifyWebhookSignature";
import { generateQrCodeDataUrl } from "@/lib/tickets/qrCode";

export async function POST(request: Request) {
  const xSignature = request.headers.get("x-signature") ?? "";
  const xRequestId = request.headers.get("x-request-id") ?? "";
  const body = await request.json();

  await debugLog("requisição recebida", { xSignature, xRequestId, body });

  try {
    return await handleWebhook({ xSignature, xRequestId, body });
  } catch (err) {
    // Captura qualquer exceção não tratada nos passos abaixo (ex: a chamada
    // à API do Mercado Pago falhando) — sem isso, o erro sumiria como um
    // 500 genérico sem deixar rastro nenhum de qual passo quebrou.
    console.error("[webhook mercadopago] erro inesperado", {
      error: err instanceof Error ? err.message : String(err),
    });
    await debugLog("erro inesperado", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

async function handleWebhook({
  xSignature,
  xRequestId,
  body,
}: {
  xSignature: string;
  xRequestId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}) {
  const dataId = body?.data?.id;
  if (!dataId) {
    console.error("[webhook mercadopago] rejeitado: sem data.id no body", {
      body,
    });
    await debugLog("rejeitado: sem data.id no body", { body });
    return NextResponse.json({ error: "missing data.id" }, { status: 400 });
  }

  const signatureValid = verifyMercadoPagoSignature({
    xSignature,
    xRequestId,
    dataId: String(dataId),
    webhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "",
  });

  if (!signatureValid) {
    console.error("[webhook mercadopago] assinatura inválida", {
      dataId,
      xSignature,
      xRequestId,
    });
    await debugLog("assinatura inválida", { dataId, xSignature, xRequestId });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // O Mercado Pago também envia outros tópicos (ex: merchant_order) usando
  // o mesmo formato de data.id — esses não correspondem a um pagamento e
  // fetchPayment falharia. Só processamos notificações de pagamento.
  if (body?.type && body.type !== "payment") {
    console.log("[webhook mercadopago] ignorado: tipo de evento não é payment", {
      type: body.type,
      dataId,
    });
    await debugLog("ignorado: tipo de evento não é payment", { type: body.type, dataId });
    return NextResponse.json({ received: true });
  }

  const payment = await fetchPayment(String(dataId));
  console.log("[webhook mercadopago] payment obtido", {
    dataId,
    status: payment.status,
    externalReference: payment.external_reference,
    transactionAmount: payment.transaction_amount,
  });
  await debugLog("payment obtido", {
    dataId,
    status: payment.status,
    externalReference: payment.external_reference,
    transactionAmount: payment.transaction_amount,
  });

  if (payment.status !== "approved") {
    console.log("[webhook mercadopago] ignorado: status não é approved", {
      dataId,
      status: payment.status,
    });
    await debugLog("ignorado: status não é approved", { dataId, status: payment.status });
    return NextResponse.json({ received: true });
  }

  const orderId = payment.external_reference;
  if (!orderId) {
    console.error("[webhook mercadopago] pagamento sem external_reference", {
      dataId,
    });
    await debugLog("pagamento sem external_reference", { dataId });
    return NextResponse.json(
      { error: "missing external_reference" },
      { status: 400 },
    );
  }

  const order = await findOrderById(orderId);
  if (!order) {
    console.error("[webhook mercadopago] order não encontrada no banco", {
      dataId,
      orderId,
    });
    await debugLog("order não encontrada no banco", { dataId, orderId });
    return NextResponse.json({ received: true });
  }

  // Defesa em profundidade: confirma que o valor realmente pago bate com o
  // valor esperado do pedido antes de criar qualquer ticket.
  const paidAmountCents = Math.round((payment.transaction_amount ?? 0) * 100);
  if (paidAmountCents !== order.totalAmountCents) {
    console.error("[webhook mercadopago] valor pago não bate com o pedido", {
      dataId,
      orderId,
      paidAmountCents,
      expectedAmountCents: order.totalAmountCents,
    });
    await debugLog("valor pago não bate com o pedido", {
      dataId,
      orderId,
      paidAmountCents,
      expectedAmountCents: order.totalAmountCents,
    });
    return NextResponse.json({ error: "amount mismatch" }, { status: 400 });
  }

  const result = await markOrderAsPaidAndCreateTickets({
    orderId,
    mercadoPagoPaymentId: String(dataId),
  });

  console.log("[webhook mercadopago] pedido processado", {
    orderId,
    alreadyProcessed: result.alreadyProcessed,
    ticketCount: result.alreadyProcessed ? null : result.tickets.length,
  });
  await debugLog("pedido processado", {
    orderId,
    alreadyProcessed: result.alreadyProcessed,
    ticketCount: result.alreadyProcessed ? null : result.tickets.length,
  });

  if (!result.alreadyProcessed) {
    const event = await findEventById(result.order.eventId);
    if (!event) {
      console.error("[webhook mercadopago] evento não encontrado para o pedido", {
        orderId,
        eventId: result.order.eventId,
      });
      await debugLog("evento não encontrado para o pedido", {
        orderId,
        eventId: result.order.eventId,
      });
    } else {
      for (const ticket of result.tickets) {
        try {
          const qrCodeDataUrl = await generateQrCodeDataUrl(ticket.qrToken);
          await sendTicketEmail({
            buyerEmail: result.order.buyerEmail,
            buyerName: ticket.buyerName,
            eventName: event.name,
            eventLocation: event.location,
            eventStartsAt: event.startsAt,
            qrCodeDataUrl,
            ticketId: ticket.id,
          });
          console.log("[webhook mercadopago] e-mail do ticket enviado", {
            ticketId: ticket.id,
            buyerEmail: result.order.buyerEmail,
          });
          await debugLog("e-mail do ticket enviado", {
            ticketId: ticket.id,
            buyerEmail: result.order.buyerEmail,
          });
        } catch (err) {
          // Não deixamos o envio de e-mail falho derrubar o webhook inteiro
          // (isso faria o Mercado Pago re-tentar e recriar tickets
          // duplicados via retry). O erro fica registrado no log pra
          // investigação, e o ticket já criado continua válido mesmo sem
          // o e-mail ter saído.
          console.error("[webhook mercadopago] falha ao enviar e-mail do ticket", {
            ticketId: ticket.id,
            buyerEmail: result.order.buyerEmail,
            error: err instanceof Error ? err.message : String(err),
          });
          await debugLog("falha ao enviar e-mail do ticket", {
            ticketId: ticket.id,
            buyerEmail: result.order.buyerEmail,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
