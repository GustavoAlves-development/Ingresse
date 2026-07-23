import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../../tests/testDb";
import {
  createOrder,
  findOrderById,
  markOrderAsPaidAndCreateTickets,
} from "./orderRepository";

describe("orderRepository", () => {
  let organizerId: string;
  let eventId: string;

  beforeEach(async () => {
    await resetDatabase();
    const organizer = await testPrisma.organizer.create({
      data: { name: "Organizador Teste", email: "org@teste.dev" },
    });
    organizerId = organizer.id;
    const event = await testPrisma.event.create({
      data: {
        organizerId,
        name: "Show de Teste",
        slug: "show-de-teste",
        location: "São Paulo, SP",
        startsAt: new Date("2026-12-01T23:00:00.000Z"),
        ticketPriceCents: 5000,
        capacity: 100,
        status: "PUBLISHED",
      },
    });
    eventId = event.id;
  });

  describe("createOrder", () => {
    it("creates a pending order with organizerId denormalized from the event", async () => {
      const order = await createOrder({
        eventId,
        organizerId,
        buyerName: "Comprador Teste",
        buyerEmail: "comprador@teste.dev",
        quantity: 2,
        totalAmountCents: 10000,
      });

      expect(order.status).toBe("PENDING");
      expect(order.organizerId).toBe(organizerId);
    });
  });

  describe("markOrderAsPaidAndCreateTickets", () => {
    it("marks the order as paid and creates one ticket per quantity unit", async () => {
      const order = await createOrder({
        eventId,
        organizerId,
        buyerName: "Comprador Teste",
        buyerEmail: "comprador@teste.dev",
        quantity: 2,
        totalAmountCents: 10000,
      });

      const result = await markOrderAsPaidAndCreateTickets({
        orderId: order.id,
        mercadoPagoPaymentId: "mp-payment-123",
      });

      expect(result.alreadyProcessed).toBe(false);
      if (!result.alreadyProcessed) {
        expect(result.order.status).toBe("PAID");
        expect(result.tickets).toHaveLength(2);
        expect(result.tickets[0].organizerId).toBe(organizerId);
        expect(result.tickets[0].eventId).toBe(eventId);
        expect(result.tickets[0].status).toBe("VALID");
        expect(result.tickets[0].qrToken).not.toBe(result.tickets[1].qrToken);
      }
    });

    it("is idempotent: processing the same payment twice does not duplicate tickets", async () => {
      const order = await createOrder({
        eventId,
        organizerId,
        buyerName: "Comprador Teste",
        buyerEmail: "comprador@teste.dev",
        quantity: 1,
        totalAmountCents: 5000,
      });

      const first = await markOrderAsPaidAndCreateTickets({
        orderId: order.id,
        mercadoPagoPaymentId: "mp-payment-456",
      });
      const second = await markOrderAsPaidAndCreateTickets({
        orderId: order.id,
        mercadoPagoPaymentId: "mp-payment-456",
      });

      expect(first.alreadyProcessed).toBe(false);
      expect(second.alreadyProcessed).toBe(true);

      const ticketCount = await testPrisma.ticket.count({
        where: { orderId: order.id },
      });
      expect(ticketCount).toBe(1);
    });
  });

  describe("findOrderById", () => {
    it("returns null for a nonexistent order", async () => {
      const found = await findOrderById(crypto.randomUUID());

      expect(found).toBeNull();
    });
  });
});
