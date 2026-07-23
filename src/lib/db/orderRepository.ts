import { OrderStatus, TicketStatus } from "@prisma/client";
import { generateQrToken } from "../tickets/qrToken";
import { prisma } from "./prismaClient";

type CreateOrderInput = {
  eventId: string;
  organizerId: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  totalAmountCents: number;
};

export async function createOrder(input: CreateOrderInput) {
  return prisma.order.create({ data: input });
}

export async function findOrderById(orderId: string) {
  return prisma.order.findUnique({ where: { id: orderId } });
}

export async function markOrderAsPaidAndCreateTickets(params: {
  orderId: string;
  mercadoPagoPaymentId: string;
}) {
  return prisma.$transaction(async (tx) => {
    // UPDATE atômico condicional: só transiciona PENDING -> PAID. Se o
    // Mercado Pago reenviar a mesma notificação, a segunda tentativa
    // encontra status já diferente de PENDING e não afeta nenhuma linha —
    // idempotência sem lock explícito, mesmo padrão de updateEvent (Fase 3).
    const updateResult = await tx.order.updateMany({
      where: { id: params.orderId, status: OrderStatus.PENDING },
      data: {
        status: OrderStatus.PAID,
        paidAt: new Date(),
        mercadoPagoPaymentId: params.mercadoPagoPaymentId,
      },
    });

    if (updateResult.count === 0) {
      return { alreadyProcessed: true as const };
    }

    const order = await tx.order.findUniqueOrThrow({
      where: { id: params.orderId },
    });

    const tickets = await Promise.all(
      Array.from({ length: order.quantity }, () =>
        tx.ticket.create({
          data: {
            eventId: order.eventId,
            organizerId: order.organizerId,
            orderId: order.id,
            qrToken: generateQrToken(),
            buyerName: order.buyerName,
            status: TicketStatus.VALID,
          },
        }),
      ),
    );

    return { alreadyProcessed: false as const, order, tickets };
  });
}
