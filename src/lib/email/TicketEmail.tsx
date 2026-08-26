type TicketEmailProps = {
  buyerName: string;
  eventName: string;
  eventLocation: string;
  eventStartsAt: Date;
  qrCodeDataUrl: string;
  ticketCode: string;
};

// Paleta e tipografia espelham o tema da plataforma (src/app/globals.css),
// mas expressas como estilos inline: clientes de e-mail (Outlook, Gmail
// mobile etc.) não confiam em <style>/classes, então cada elemento carrega
// seus próprios estilos e o layout usa <table> em vez de flex/grid.
const COLORS = {
  background: "#0a0a0f",
  card: "#16161f",
  cardBorder: "#2a2a35",
  foreground: "#f2f2f5",
  muted: "#9a9aa8",
  primary: "#4b7fff",
  primaryForeground: "#ffffff",
};

const FONT_HEADING =
  "'Space Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_BODY = "'Work Sans', 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'Courier New', monospace";

export function TicketEmail({
  buyerName,
  eventName,
  eventLocation,
  eventStartsAt,
  qrCodeDataUrl,
  ticketCode,
}: TicketEmailProps) {
  const formattedDate = eventStartsAt.toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <div
      style={{
        backgroundColor: COLORS.background,
        padding: "32px 16px",
        fontFamily: FONT_BODY,
      }}
    >
      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        style={{ maxWidth: "560px", margin: "0 auto" }}
      >
        {/* Cabeçalho da marca */}
        <tbody>
          <tr>
            <td style={{ textAlign: "center", paddingBottom: "24px" }}>
              <span
                style={{
                  fontFamily: FONT_HEADING,
                  fontSize: "14px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: COLORS.primary,
                }}
              >
                🎟️ Plataforma de Ingressos
              </span>
            </td>
          </tr>

          {/* Cartão do ingresso */}
          <tr>
            <td
              style={{
                backgroundColor: COLORS.card,
                border: `1px solid ${COLORS.cardBorder}`,
                borderRadius: "16px",
                overflow: "hidden",
              }}
            >
              <table
                role="presentation"
                width="100%"
                cellPadding={0}
                cellSpacing={0}
              >
                <tbody>
                  {/* Faixa superior colorida */}
                  <tr>
                    <td
                      style={{
                        backgroundColor: COLORS.primary,
                        height: "6px",
                        fontSize: 0,
                        lineHeight: 0,
                      }}
                    >
                      &nbsp;
                    </td>
                  </tr>

                  {/* Nome do evento + saudação */}
                  <tr>
                    <td style={{ padding: "28px 28px 20px" }}>
                      <p
                        style={{
                          margin: "0 0 4px",
                          fontFamily: FONT_BODY,
                          fontSize: "13px",
                          color: COLORS.muted,
                        }}
                      >
                        Olá, {buyerName}! Seu ingresso está confirmado.
                      </p>
                      <h1
                        style={{
                          margin: 0,
                          fontFamily: FONT_HEADING,
                          fontSize: "24px",
                          fontWeight: 700,
                          color: COLORS.foreground,
                          lineHeight: 1.3,
                        }}
                      >
                        {eventName}
                      </h1>
                    </td>
                  </tr>

                  {/* Local e data */}
                  <tr>
                    <td style={{ padding: "0 28px 24px" }}>
                      <table role="presentation" cellPadding={0} cellSpacing={0}>
                        <tbody>
                          <tr>
                            <td style={{ paddingBottom: "8px" }}>
                              <span
                                style={{
                                  fontFamily: FONT_BODY,
                                  fontSize: "14px",
                                  color: COLORS.foreground,
                                }}
                              >
                                📍&nbsp; {eventLocation}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <span
                                style={{
                                  fontFamily: FONT_BODY,
                                  fontSize: "14px",
                                  color: COLORS.foreground,
                                }}
                              >
                                🗓️&nbsp; {formattedDate}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Picote / perfuração do ticket */}
                  <tr>
                    <td style={{ padding: "0 0" }}>
                      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                        <tbody>
                          <tr>
                            <td
                              style={{
                                borderTop: `2px dashed ${COLORS.cardBorder}`,
                                fontSize: 0,
                                lineHeight: 0,
                              }}
                            >
                              &nbsp;
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* QR code */}
                  <tr>
                    <td style={{ padding: "24px 28px 8px", textAlign: "center" }}>
                      <table
                        role="presentation"
                        cellPadding={0}
                        cellSpacing={0}
                        style={{ margin: "0 auto" }}
                      >
                        <tbody>
                          <tr>
                            <td
                              style={{
                                backgroundColor: "#ffffff",
                                borderRadius: "12px",
                                padding: "16px",
                              }}
                            >
                              <img
                                src={qrCodeDataUrl}
                                alt={`QR Code do ingresso - código ${ticketCode}`}
                                width={200}
                                height={200}
                                style={{ display: "block" }}
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <p
                        style={{
                          margin: "16px 0 0",
                          fontFamily: FONT_BODY,
                          fontSize: "13px",
                          color: COLORS.muted,
                        }}
                      >
                        Apresente este QR Code na entrada do evento
                      </p>
                    </td>
                  </tr>

                  {/* Código alternativo, caso a imagem não carregue no cliente de e-mail */}
                  <tr>
                    <td style={{ padding: "8px 28px 28px", textAlign: "center" }}>
                      <p
                        style={{
                          margin: "0 0 6px",
                          fontFamily: FONT_BODY,
                          fontSize: "11px",
                          color: COLORS.muted,
                        }}
                      >
                        Se a imagem não aparecer, informe este código na
                        portaria:
                      </p>
                      <span
                        style={{
                          fontFamily: FONT_MONO,
                          fontSize: "16px",
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          color: COLORS.foreground,
                          backgroundColor: COLORS.background,
                          border: `1px solid ${COLORS.cardBorder}`,
                          borderRadius: "6px",
                          padding: "6px 12px",
                          display: "inline-block",
                        }}
                      >
                        {ticketCode}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* Rodapé */}
          <tr>
            <td style={{ padding: "20px 12px 0", textAlign: "center" }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: FONT_BODY,
                  fontSize: "12px",
                  color: COLORS.muted,
                }}
              >
                Guarde este e-mail — ele é o seu ingresso. Em caso de dúvidas,
                entre em contato com a organização do evento.
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
