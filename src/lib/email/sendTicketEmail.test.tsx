import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn().mockResolvedValue({ data: { id: "email_123" }, error: null });

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

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
});
