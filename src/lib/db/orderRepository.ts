import { OrderStatus, Prisma, TicketStatus } from "@prisma/client";
import { generateQrToken } from "../tickets/qrToken";
import { prisma } from "./prismaClient";

type CreateOrderInput = {
  eventId: string;
  organizerId: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  totalAmountCents: number;
  capacity: number;
};

export class EventSoldOutError extends Error {
  constructor() {
    super("O evento não tem vagas suficientes para essa quantidade de ingressos");
    this.name = "EventSoldOutError";
  }
}

export async function createOrder(input: CreateOrderInput) {
  const { capacity, ...orderData } = input;

  return prisma.$transaction(
    async (tx) => {
      // Soma pedidos PAID e PENDING: a vaga é reservada assim que o
      // checkout começa, não só quando o pagamento é confirmado — evita
      // vender além da capacidade enquanto pagamentos estão em andamento
      // no Mercado Pago. Isolamento serializable evita que dois checkouts
      // simultâneos leiam a mesma contagem e passem os dois pela checagem.
      const reserved = await tx.order.aggregate({
        where: {
          eventId: input.eventId,
          status: { in: [OrderStatus.PAID, OrderStatus.PENDING] },
        },
        _sum: { quantity: true },
      });

      if ((reserved._sum.quantity ?? 0) + input.quantity > capacity) {
        throw new EventSoldOutError();
      }

      return tx.order.create({ data: orderData });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
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
