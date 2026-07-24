import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDatabase, testPrisma } from "../../../../../tests/testDb";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: authMock,
}));

const { POST } = await import("./route");

function buildRequest(qrToken: unknown) {
  return new Request("http://localhost/api/tickets/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ qrToken }),
  });
}

describe("POST /api/tickets/validate", () => {
  let organizerId: string;
  let staffUserId: string;
  let eventId: string;
  let orderId: string;

  beforeEach(async () => {
    await resetDatabase();
    authMock.mockReset();

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
        slug: "show-validate-route-teste",
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

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(buildRequest("qualquer-token"));

    expect(response.status).toBe(401);
  });

  it("returns 400 for an empty qrToken", async () => {
    authMock.mockResolvedValue({
      user: { id: staffUserId, organizerId, role: "PORTARIA_STAFF" },
    });

    const response = await POST(buildRequest(""));

    expect(response.status).toBe(400);
  });

  it("validates a valid ticket and returns SUCCESS with the buyer name", async () => {
    authMock.mockResolvedValue({
      user: { id: staffUserId, organizerId, role: "PORTARIA_STAFF" },
    });
    const ticket = await testPrisma.ticket.create({
      data: {
        eventId,
        organizerId,
        orderId,
        qrToken: "token-valido-rota-001",
        buyerName: "Comprador Teste",
        status: "VALID",
      },
    });

    const response = await POST(buildRequest(ticket.qrToken));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result).toBe("SUCCESS");
    expect(body.buyerName).toBe("Comprador Teste");
  });

  it("does not validate a ticket belonging to another organizer", async () => {
    const otherOrganizer = await testPrisma.organizer.create({
      data: { name: "Outro Organizador", email: "outro-rota@teste.dev" },
    });
    const otherEvent = await testPrisma.event.create({
      data: {
        organizerId: otherOrganizer.id,
        name: "Outro Show",
        slug: "outro-show-validate-route-teste",
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
        buyerEmail: "outro-comprador-rota@teste.dev",
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
        qrToken: "token-de-outro-organizador-rota",
        buyerName: "Outro Comprador",
        status: "VALID",
      },
    });

    authMock.mockResolvedValue({
      user: { id: staffUserId, organizerId, role: "PORTARIA_STAFF" },
    });

    const response = await POST(buildRequest(otherTicket.qrToken));
    const body = await response.json();

    expect(body.result).toBe("INVALID");
    expect(body.buyerName).toBeNull();
  });
});
