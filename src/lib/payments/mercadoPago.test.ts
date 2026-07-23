import { beforeEach, describe, expect, it, vi } from "vitest";

const preferenceCreateMock = vi.fn();
const paymentGetMock = vi.fn();

vi.mock("mercadopago", () => ({
  MercadoPagoConfig: vi.fn().mockImplementation(() => ({})),
  Preference: vi.fn().mockImplementation(() => ({
    create: preferenceCreateMock,
  })),
  Payment: vi.fn().mockImplementation(() => ({
    get: paymentGetMock,
  })),
}));

const { createCheckoutPreference, fetchPayment } = await import(
  "./mercadoPago"
);

describe("createCheckoutPreference", () => {
  beforeEach(() => {
    preferenceCreateMock.mockReset();
  });

  it("builds a preference from the event price and quantity, in reais", async () => {
    preferenceCreateMock.mockResolvedValue({
      id: "pref_123",
      init_point: "https://mp.test/checkout/pref_123",
    });

    const result = await createCheckoutPreference({
      orderId: "order_1",
      eventName: "Show de Teste",
      ticketPriceCents: 5000,
      quantity: 2,
      notificationUrl: "https://app.test/api/webhooks/mercadopago",
    });

    expect(result.initPoint).toBe("https://mp.test/checkout/pref_123");
    const callArgs = preferenceCreateMock.mock.calls[0][0];
    expect(callArgs.body.items[0].unit_price).toBe(50);
    expect(callArgs.body.items[0].quantity).toBe(2);
    expect(callArgs.body.external_reference).toBe("order_1");
    expect(callArgs.body.notification_url).toBe(
      "https://app.test/api/webhooks/mercadopago",
    );
  });
});

describe("fetchPayment", () => {
  it("fetches payment details by id", async () => {
    paymentGetMock.mockResolvedValue({ id: 123, status: "approved" });

    const payment = await fetchPayment("123");

    expect(payment.status).toBe("approved");
    expect(paymentGetMock).toHaveBeenCalledWith({ id: "123" });
  });
});
