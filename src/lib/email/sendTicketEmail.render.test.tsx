// Teste SEM mock do SDK do Resend — verifica que a renderização real de
// componentes React (via @react-email/render, usado internamente por
// resend.emails.send) funciona de verdade, prevenindo a regressão onde
// essa dependência estava faltando e o envio de e-mail quebrava em
// produção apesar de todos os testes mockados passarem. Este arquivo
// não pode ter vi.mock("resend", ...) em lugar nenhum, senão o SDK real
// nunca é exercitado (foi exatamente esse o bug do teste anterior).
import { describe, expect, it } from "vitest";
import { Resend } from "resend";
import { TicketEmail } from "./TicketEmail";

describe("Resend SDK real render (no mock)", () => {
  it("renders the TicketEmail component without a missing-dependency error", async () => {
    const resend = new Resend("re_test_key_not_real");

    const { error } = await resend.emails.send({
      from: "test@test.dev",
      to: "test@test.dev",
      subject: "teste",
      react: (
        <TicketEmail
          buyerName="Teste"
          eventName="Evento Teste"
          eventLocation="São Paulo, SP"
          eventStartsAt={new Date("2026-12-01T23:00:00.000Z")}
          qrCodeDataUrl="data:image/png;base64,AAAA"
        />
      ),
    });

    // A chamada de rede falha (API key falsa/inexistente), mas isso prova
    // que a etapa de RENDERIZAÇÃO passou — se @react-email/render
    // estivesse faltando, o erro seria sobre isso, não sobre a API key.
    expect(error?.message ?? "").not.toMatch(/Failed to render/i);
    expect(error?.message ?? "").not.toMatch(/@react-email/i);
  });
});
