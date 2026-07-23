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

// Verificação do Achado 1 (dependência faltando quebrava a renderização do
// componente React em produção): esta suíte NÃO mocka o SDK "resend", usando
// um client real (com API key falsa) para provar que a etapa de renderização
// via @react-email/render funciona. A chamada de rede em si falhará (API key
// falsa/inexistente), o que é esperado — o que importa é que o erro
// capturado não seja o erro de renderização.
describe("sendTicketEmail (real Resend SDK, no mock)", () => {
  it("renders the TicketEmail React component without the missing @react-email/render error", async () => {
    vi.resetModules();
    const { Resend } = await import("resend");
    const { TicketEmail } = await import("./TicketEmail");

    const resend = new Resend("re_test_key_not_real");

    let caughtError: unknown = null;
    try {
      await resend.emails.send({
        from: "test@test.dev",
        to: "test@test.dev",
        subject: "teste",
        react: (
          <TicketEmail
            buyerName="Comprador Teste"
            eventName="Show de Teste"
            eventLocation="São Paulo, SP"
            eventStartsAt={new Date("2026-12-01T23:00:00.000Z")}
            qrCodeDataUrl="data:image/png;base64,AAAA"
          />
        ),
      });
    } catch (err) {
      caughtError = err;
    }

    const errorMessage =
      caughtError instanceof Error ? caughtError.message : String(caughtError ?? "");

    // A chamada de rede real deve falhar (chave de API falsa), mas isso NÃO
    // deve ser um erro de renderização do React/@react-email/render.
    expect(errorMessage).not.toMatch(/Failed to render React component/i);
    expect(errorMessage).not.toMatch(/@react-email\/render/i);
  });
});
