import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../../tests/testDb";
import { validateTicketForOrganizer } from "./ticketRepository";

describe("validateTicketForOrganizer", () => {
  let organizerId: string;
  let staffUserId: string;
  let eventId: string;
  let orderId: string;

  beforeEach(async () => {
    await resetDatabase();

    const organizer = await testPrisma.organizer.create({
      data: { name: "Organizador Teste", email: "org@teste.dev" },
    });
    organizerId = organizer.id;

    const staff = await testPrisma.user.create({
      data: {
        organizerId,
        name: "Staff Teste",
        email: "staff@teste.dev",
        passwordHash: "hash-fake",
        role: "PORTARIA_STAFF",
      },
    });
    staffUserId = staff.id;

    const event = await testPrisma.event.create({
      data: {
        organizerId,
        name: "Show de Teste",
        slug: "show-portaria-teste",
        location: "São Paulo, SP",
        startsAt: new Date("2026-12-01T23:00:00.000Z"),
        ticketPriceCents: 5000,
        capacity: 100,
        status: "PUBLISHED",
      },
    });
    eventId = event.id;

    const order = await testPrisma.order.create({
      data: {
        eventId,
        organizerId,
        buyerName: "Comprador Teste",
        buyerEmail: "comprador@teste.dev",
        quantity: 1,
        totalAmountCents: 5000,
        status: "PAID",
      },
    });
    orderId = order.id;
  });

  async function createTicket(qrToken: string) {
    return testPrisma.ticket.create({
      data: {
        eventId,
        organizerId,
        orderId,
        qrToken,
        buyerName: "Comprador Teste",
        status: "VALID",
      },
    });
  }

  it("marks a valid ticket as used and logs a SUCCESS check-in attempt", async () => {
    const ticket = await createTicket("token-valido-001");

    const { result, ticket: updated } = await validateTicketForOrganizer(
      organizerId,
      ticket.qrToken,
      staffUserId,
    );

    expect(result).toBe("SUCCESS");
    expect(updated?.status).toBe("USED");
    expect(updated?.usedByUserId).toBe(staffUserId);

    const attempts = await testPrisma.checkInAttempt.findMany({
      where: { ticketId: ticket.id },
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].result).toBe("SUCCESS");
  });

  it("returns ALREADY_USED for a ticket that was already validated", async () => {
    const ticket = await createTicket("token-ja-usado-001");
    await validateTicketForOrganizer(organizerId, ticket.qrToken, staffUserId);

    const { result, ticket: found } = await validateTicketForOrganizer(
      organizerId,
      ticket.qrToken,
      staffUserId,
    );

    expect(result).toBe("ALREADY_USED");
    expect(found?.status).toBe("USED");

    const attempts = await testPrisma.checkInAttempt.findMany({
      where: { ticketId: ticket.id },
    });
    expect(attempts).toHaveLength(2);
    expect(attempts[1].result).toBe("ALREADY_USED");
  });

  it("returns INVALID for a qrToken that does not exist", async () => {
    const { result, ticket } = await validateTicketForOrganizer(
      organizerId,
      "token-que-nao-existe",
      staffUserId,
    );

    expect(result).toBe("INVALID");
    expect(ticket).toBeNull();
  });

  it("returns INVALID for a ticket that belongs to another organizer", async () => {
    const otherOrganizer = await testPrisma.organizer.create({
      data: { name: "Outro Organizador", email: "outro@teste.dev" },
    });
    const otherEvent = await testPrisma.event.create({
      data: {
        organizerId: otherOrganizer.id,
        name: "Outro Show",
        slug: "outro-show-portaria-teste",
        location: "Rio de Janeiro, RJ",
        startsAt: new Date("2026-12-01T23:00:00.000Z"),
        ticketPriceCents: 3000,
        capacity: 50,
        status: "PUBLISHED",
      },
    });
    const otherOrder = await testPrisma.order.create({
      data: {
        eventId: otherEvent.id,
        organizerId: otherOrganizer.id,
        buyerName: "Outro Comprador",
        buyerEmail: "outro-comprador@teste.dev",
        quantity: 1,
        totalAmountCents: 3000,
        status: "PAID",
      },
    });
    const otherTicket = await testPrisma.ticket.create({
      data: {
        eventId: otherEvent.id,
        organizerId: otherOrganizer.id,
        orderId: otherOrder.id,
        qrToken: "token-de-outro-organizador",
        buyerName: "Outro Comprador",
        status: "VALID",
      },
    });

    const { result, ticket } = await validateTicketForOrganizer(
      organizerId,
      otherTicket.qrToken,
      staffUserId,
    );

    expect(result).toBe("INVALID");
    expect(ticket).toBeNull();

    const attempts = await testPrisma.checkInAttempt.findMany({
      where: { ticketId: otherTicket.id },
    });
    expect(attempts).toHaveLength(0);
  });

  it("is safe under real concurrency: two simultaneous reads of the same qrToken only succeed once", async () => {
    const ticket = await createTicket("token-concorrente-001");

    const [first, second] = await Promise.all([
      validateTicketForOrganizer(organizerId, ticket.qrToken, staffUserId),
      validateTicketForOrganizer(organizerId, ticket.qrToken, staffUserId),
    ]);

    const successes = [first, second].filter((r) => r.result === "SUCCESS");
    const alreadyUsed = [first, second].filter(
      (r) => r.result === "ALREADY_USED",
    );
    expect(successes).toHaveLength(1);
    expect(alreadyUsed).toHaveLength(1);

    const finalTicket = await testPrisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    expect(finalTicket.status).toBe("USED");
  });
});
