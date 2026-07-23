import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDatabase, testPrisma } from "../../../../../tests/testDb";

const fetchPaymentMock = vi.fn();
vi.mock("@/lib/payments/mercadoPago", () => ({
  fetchPayment: fetchPaymentMock,
}));

const sendTicketEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email/sendTicketEmail", () => ({
  sendTicketEmail: sendTicketEmailMock,
}));

const webhookSecret = "test-webhook-secret";
process.env.MERCADO_PAGO_WEBHOOK_SECRET = webhookSecret;

const { POST } = await import("./route");

function buildSignedRequest(
  dataId: string,
  requestId: string,
  extraBody: Record<string, unknown> = {},
) {
  const ts = "1700000000";
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = createHmac("sha256", webhookSecret).update(manifest).digest("hex");

  return new Request("http://localhost/api/webhooks/mercadopago", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature": `ts=${ts},v1=${hash}`,
      "x-request-id": requestId,
    },
    body: JSON.stringify({ data: { id: dataId }, ...extraBody }),
  });
}

describe("POST /api/webhooks/mercadopago", () => {
  let organizerId: string;
  let eventId: string;
  let orderId: string;

  beforeEach(async () => {
    await resetDatabase();
    fetchPaymentMock.mockReset();
    sendTicketEmailMock.mockClear();

    const organizer = await testPrisma.organizer.create({
      data: { name: "Organizador Teste", email: "org@teste.dev" },
    });
    organizerId = organizer.id;
    const event = await testPrisma.event.create({
      data: {
        organizerId,
        name: "Show de Teste",
        slug: "show-webhook-teste",
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
        status: "PENDING",
      },
    });
    orderId = order.id;
  });

  it("rejects a request with an invalid signature", async () => {
    const request = new Request("http://localhost/api/webhooks/mercadopago", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature": "ts=123,v1=deadbeef",
        "x-request-id": "req-1",
      },
      body: JSON.stringify({ data: { id: "payment-1" } }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(fetchPaymentMock).not.toHaveBeenCalled();
  });

  it("marks the order as paid and sends the ticket email on an approved payment", async () => {
    fetchPaymentMock.mockResolvedValue({
      status: "approved",
      external_reference: orderId,
      transaction_amount: 50,
    });

    const request = buildSignedRequest("payment-1", "req-1");
    const response = await POST(request);

    expect(response.status).toBe(200);

    const updatedOrder = await testPrisma.order.findUnique({
      where: { id: orderId },
    });
    expect(updatedOrder?.status).toBe("PAID");

    const tickets = await testPrisma.ticket.findMany({ where: { orderId } });
    expect(tickets).toHaveLength(1);

    expect(sendTicketEmailMock).toHaveBeenCalledTimes(1);
    expect(sendTicketEmailMock.mock.calls[0][0].buyerEmail).toBe(
      "comprador@teste.dev",
    );
  });

  it("is idempotent: the same notification processed twice does not resend the email", async () => {
    fetchPaymentMock.mockResolvedValue({
      status: "approved",
      external_reference: orderId,
      transaction_amount: 50,
    });

    await POST(buildSignedRequest("payment-1", "req-1"));
    await POST(buildSignedRequest("payment-1", "req-2"));

    const tickets = await testPrisma.ticket.findMany({ where: { orderId } });
    expect(tickets).toHaveLength(1);
    expect(sendTicketEmailMock).toHaveBeenCalledTimes(1);
  });

  it("does not create tickets when the payment is not approved", async () => {
    fetchPaymentMock.mockResolvedValue({
      status: "pending",
      external_reference: orderId,
    });

    const request = buildSignedRequest("payment-1", "req-1");
    const response = await POST(request);

    expect(response.status).toBe(200);
    const tickets = await testPrisma.ticket.findMany({ where: { orderId } });
    expect(tickets).toHaveLength(0);
    expect(sendTicketEmailMock).not.toHaveBeenCalled();
  });

  it("sends one email per ticket when quantity is greater than 1", async () => {
    const multiTicketOrder = await testPrisma.order.create({
      data: {
        eventId,
        organizerId,
        buyerName: "Comprador Multi",
        buyerEmail: "multi@teste.dev",
        quantity: 2,
        totalAmountCents: 10000,
        status: "PENDING",
      },
    });

    fetchPaymentMock.mockResolvedValue({
      status: "approved",
      external_reference: multiTicketOrder.id,
      transaction_amount: 100,
    });

    const request = buildSignedRequest("payment-multi", "req-multi");
    await POST(request);

    const tickets = await testPrisma.ticket.findMany({
      where: { orderId: multiTicketOrder.id },
    });
    expect(tickets).toHaveLength(2);

    expect(sendTicketEmailMock).toHaveBeenCalledTimes(2);

    const qrCodeUrlsUsed = sendTicketEmailMock.mock.calls.map(
      (call) => call[0].qrCodeDataUrl,
    );
    expect(qrCodeUrlsUsed[0]).not.toBe(qrCodeUrlsUsed[1]);
  });

  it("returns 200 without sending email when external_reference points to a nonexistent order", async () => {
    fetchPaymentMock.mockResolvedValue({
      status: "approved",
      external_reference: crypto.randomUUID(),
    });

    const request = buildSignedRequest("payment-ghost", "req-ghost");
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sendTicketEmailMock).not.toHaveBeenCalled();
  });

  it("ignores notifications that are not of type 'payment'", async () => {
    const request = buildSignedRequest("merchant-order-1", "req-mo", {
      type: "merchant_order",
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(fetchPaymentMock).not.toHaveBeenCalled();
  });

  it("rejects and does not mark the order paid when the paid amount does not match the order total", async () => {
    fetchPaymentMock.mockResolvedValue({
      status: "approved",
      external_reference: orderId,
      transaction_amount: 1,
    });

    const request = buildSignedRequest("payment-mismatch", "req-mismatch");
    const response = await POST(request);

    expect(response.status).toBe(400);

    const updatedOrder = await testPrisma.order.findUnique({
      where: { id: orderId },
    });
    expect(updatedOrder?.status).toBe("PENDING");

    const tickets = await testPrisma.ticket.findMany({ where: { orderId } });
    expect(tickets).toHaveLength(0);
    expect(sendTicketEmailMock).not.toHaveBeenCalled();
  });
});
