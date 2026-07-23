import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn().mockResolvedValue({ data: { id: "email_123" }, error: null });

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

// getResendClient() exige RESEND_API_KEY antes de instanciar (mesmo com o
// SDK mockado, essa checagem é lógica pura do nosso módulo). Como o SDK
// está mockado, o valor não precisa ser uma chave real.
process.env.RESEND_API_KEY = "re_test_fake_key";

const { sendTicketEmail } = await import("./sendTicketEmail");

describe("sendTicketEmail", () => {
  beforeEach(() => {
    sendMock.mockClear();
  });

  it("sends the ticket email to the buyer with the event details", async () => {
    await sendTicketEmail({
      buyerEmail: "comprador@teste.dev",
      buyerName: "Comprador Teste",
      eventName: "Show de Teste",
      eventLocation: "São Paulo, SP",
      eventStartsAt: new Date("2026-12-01T23:00:00.000Z"),
      qrCodeDataUrl: "data:image/png;base64,AAAA",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const callArgs = sendMock.mock.calls[0][0];
    expect(callArgs.to).toBe("comprador@teste.dev");
    expect(callArgs.subject).toContain("Show de Teste");
  });

  it("throws an explicit error when the Resend API returns an error field", async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: "validation_error", message: "Domínio não verificado" },
    });

    await expect(
      sendTicketEmail({
        buyerEmail: "comprador@teste.dev",
        buyerName: "Comprador Teste",
        eventName: "Show de Teste",
        eventLocation: "São Paulo, SP",
        eventStartsAt: new Date("2026-12-01T23:00:00.000Z"),
        qrCodeDataUrl: "data:image/png;base64,AAAA",
      })
    ).rejects.toThrow(/Domínio não verificado/);
  });
});
