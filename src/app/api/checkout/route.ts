import { NextResponse } from "next/server";
import { z } from "zod";
import { findEventById } from "@/lib/db/eventRepository";
import { createOrder } from "@/lib/db/orderRepository";
import { createCheckoutPreference } from "@/lib/payments/mercadoPago";

const checkoutSchema = z.object({
  eventId: z.string().uuid(),
  buyerName: z.string().trim().min(1),
  buyerEmail: z.string().email(),
  quantity: z.coerce.number().int().min(1).max(10),
});

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = checkoutSchema.safeParse({
    eventId: formData.get("eventId"),
    buyerName: formData.get("buyerName"),
    buyerEmail: formData.get("buyerEmail"),
    quantity: formData.get("quantity"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const { eventId, buyerName, buyerEmail, quantity } = parsed.data;

  const event = await findEventById(eventId);
  if (!event || event.status !== "PUBLISHED") {
    return NextResponse.json({ error: "event not available" }, { status: 404 });
  }

  // Preço sempre recalculado a partir do registro do evento — nunca
  // aceito como campo de formulário, para não permitir manipulação de valor.
  const totalAmountCents = event.ticketPriceCents * quantity;

  const order = await createOrder({
    eventId: event.id,
    organizerId: event.organizerId,
    buyerName,
    buyerEmail,
    quantity,
    totalAmountCents,
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const preference = await createCheckoutPreference({
    orderId: order.id,
    eventName: event.name,
    ticketPriceCents: event.ticketPriceCents,
    quantity,
    notificationUrl: `${appUrl}/api/webhooks/mercadopago`,
  });

  return NextResponse.redirect(preference.initPoint, { status: 303 });
}
