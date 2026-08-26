import type { OrganizerReportLine } from "@/lib/billing/dailyReport";

// Mesmo visual "cliente" do TicketEmail (azul, badge 🎟️) — de propósito
// diferente do relatório interno do dono da plataforma (que é dourado e
// tem o selo "relatório interno"). Esse e-mail é uma comunicação normal
// com o organizador, não deve parecer "interno"/confidencial.
const COLORS = {
  background: "#0a0a0f",
  card: "#16161f",
  cardBorder: "#2a2a35",
  foreground: "#f2f2f5",
  muted: "#9a9aa8",
  primary: "#4b7fff",
  success: "#22e07a",
};

const FONT_HEADING =
  "'Space Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_BODY = "'Work Sans', 'Segoe UI', Helvetica, Arial, sans-serif";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function OrganizerDailyReportEmail({
  line,
  dateLabel,
}: {
  line: OrganizerReportLine;
  dateLabel: string;
}) {
  const hasMultipleEvents = line.events.length > 1;

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

          <tr>
            <td
              style={{
                backgroundColor: COLORS.card,
                border: `1px solid ${COLORS.cardBorder}`,
                borderRadius: "16px",
                overflow: "hidden",
              }}
            >
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                <tbody>
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

                  <tr>
                    <td style={{ padding: "28px 28px 8px", textAlign: "center" }}>
                      <p
                        style={{
                          margin: "0 0 4px",
                          fontFamily: FONT_BODY,
                          fontSize: "13px",
                          color: COLORS.muted,
                        }}
                      >
                        📊 Resumo do dia — {dateLabel}
                      </p>
                      <h1
                        style={{
                          margin: 0,
                          fontFamily: FONT_HEADING,
                          fontSize: "16px",
                          fontWeight: 600,
                          color: COLORS.foreground,
                        }}
                      >
                        Olá, {line.organizerName}!
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "16px 28px 8px", textAlign: "center" }}>
                      <span
                        style={{
                          fontFamily: FONT_BODY,
                          fontSize: "13px",
                          color: COLORS.muted,
                        }}
                      >
                        Você ganhou hoje
                      </span>
                      <br />
                      <span
                        style={{
                          fontFamily: FONT_HEADING,
                          fontSize: "36px",
                          fontWeight: 700,
                          color: COLORS.success,
                        }}
                      >
                        {formatBRL(line.netCents)}
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "4px 28px 24px", textAlign: "center" }}>
                      <span
                        style={{
                          fontFamily: FONT_BODY,
                          fontSize: "13px",
                          color: COLORS.muted,
                        }}
                      >
                        {line.ticketsSold} ingresso
                        {line.ticketsSold === 1 ? "" : "s"} vendido
                        {line.ticketsSold === 1 ? "" : "s"} hoje
                      </span>
                    </td>
                  </tr>

                  {hasMultipleEvents && (
                    <tr>
                      <td style={{ padding: "0 28px 24px" }}>
                        <table
                          role="presentation"
                          width="100%"
                          cellPadding={0}
                          cellSpacing={0}
                          style={{
                            borderTop: `1px dashed ${COLORS.cardBorder}`,
                            paddingTop: "16px",
                          }}
                        >
                          <tbody>
                            {line.events.map((ev) => (
                              <tr key={ev.eventName}>
                                <td
                                  style={{
                                    padding: "4px 0",
                                    fontFamily: FONT_BODY,
                                    fontSize: "13px",
                                    color: COLORS.foreground,
                                  }}
                                >
                                  {ev.eventName}
                                </td>
                                <td
                                  style={{
                                    padding: "4px 0",
                                    textAlign: "right",
                                    fontFamily: FONT_BODY,
                                    fontSize: "13px",
                                    color: COLORS.muted,
                                  }}
                                >
                                  {ev.quantity}×
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </td>
          </tr>

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
                Resumo automático das vendas aprovadas de hoje.
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
