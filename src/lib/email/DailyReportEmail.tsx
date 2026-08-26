import type { DailyReport } from "@/lib/billing/dailyReport";

// Mesma paleta/tipografia base do TicketEmail (alinhada ao globals.css do
// site), mas com um destaque âmbar/dourado em vez do azul — de propósito,
// pra esse e-mail nunca ser confundido visualmente com um e-mail de
// ingresso na caixa de entrada. Esse é um relatório interno, só seu.
const COLORS = {
  background: "#0a0a0f",
  card: "#16161f",
  cardBorder: "#2a2a35",
  foreground: "#f2f2f5",
  muted: "#9a9aa8",
  accent: "#f0b429",
  success: "#22e07a",
};

const FONT_HEADING =
  "'Space Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_BODY = "'Work Sans', 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'Courier New', monospace";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function DailyReportEmail({ report }: { report: DailyReport }) {
  const hasSales = report.organizers.length > 0;

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
        style={{ maxWidth: "600px", margin: "0 auto" }}
      >
        <tbody>
          {/* Selo "relatório interno" — reforço visual extra pra não
              confundir com e-mail de comprador */}
          <tr>
            <td style={{ textAlign: "center", paddingBottom: "16px" }}>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: COLORS.background,
                  backgroundColor: COLORS.accent,
                  borderRadius: "999px",
                  padding: "4px 14px",
                  display: "inline-block",
                }}
              >
                🔒 Relatório interno · Ingresse
              </span>
            </td>
          </tr>

          <tr>
            <td style={{ textAlign: "center", paddingBottom: "24px" }}>
              <h1
                style={{
                  margin: 0,
                  fontFamily: FONT_HEADING,
                  fontSize: "26px",
                  fontWeight: 700,
                  color: COLORS.foreground,
                }}
              >
                💰 Fechamento do dia
              </h1>
              <p
                style={{
                  margin: "4px 0 0",
                  fontFamily: FONT_BODY,
                  fontSize: "14px",
                  color: COLORS.muted,
                }}
              >
                {report.dateLabel}
              </p>
            </td>
          </tr>

          {!hasSales ? (
            <tr>
              <td
                style={{
                  backgroundColor: COLORS.card,
                  border: `1px solid ${COLORS.cardBorder}`,
                  borderRadius: "16px",
                  padding: "32px 24px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontFamily: FONT_BODY,
                    fontSize: "14px",
                    color: COLORS.muted,
                  }}
                >
                  Nenhuma venda paga registrada hoje.
                </p>
              </td>
            </tr>
          ) : (
            <>
              {/* Totais gerais da plataforma */}
              <tr>
                <td
                  style={{
                    backgroundColor: COLORS.card,
                    border: `1px solid ${COLORS.cardBorder}`,
                    borderRadius: "16px",
                    padding: "24px",
                  }}
                >
                  <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                    <tbody>
                      <tr>
                        <td style={{ paddingBottom: "16px" }}>
                          <span
                            style={{
                              fontFamily: FONT_BODY,
                              fontSize: "12px",
                              color: COLORS.muted,
                            }}
                          >
                            Total vendido hoje ({report.totals.ticketsSold}{" "}
                            ingresso{report.totals.ticketsSold === 1 ? "" : "s"}
                            )
                          </span>
                          <br />
                          <span
                            style={{
                              fontFamily: FONT_HEADING,
                              fontSize: "28px",
                              fontWeight: 700,
                              color: COLORS.foreground,
                            }}
                          >
                            {formatBRL(report.totals.grossCents)}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            borderTop: `1px dashed ${COLORS.cardBorder}`,
                            paddingTop: "16px",
                          }}
                        >
                          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                            <tbody>
                              <tr>
                                <td width="50%" style={{ verticalAlign: "top", paddingBottom: "16px" }}>
                                  <span
                                    style={{
                                      fontFamily: FONT_BODY,
                                      fontSize: "12px",
                                      color: COLORS.muted,
                                    }}
                                  >
                                    Sua comissão (10%)
                                  </span>
                                  <br />
                                  <span
                                    style={{
                                      fontFamily: FONT_HEADING,
                                      fontSize: "20px",
                                      fontWeight: 700,
                                      color: COLORS.accent,
                                    }}
                                  >
                                    {formatBRL(report.totals.platformFeeCents)}
                                  </span>
                                </td>
                                <td width="50%" style={{ verticalAlign: "top", paddingBottom: "16px" }}>
                                  <span
                                    style={{
                                      fontFamily: FONT_BODY,
                                      fontSize: "12px",
                                      color: COLORS.muted,
                                    }}
                                  >
                                    Foi pro Mercado Pago
                                  </span>
                                  <br />
                                  <span
                                    style={{
                                      fontFamily: FONT_HEADING,
                                      fontSize: "20px",
                                      fontWeight: 700,
                                      color: COLORS.foreground,
                                    }}
                                  >
                                    −{formatBRL(report.totals.mercadoPagoFeeCents)}
                                  </span>
                                </td>
                              </tr>
                              <tr>
                                <td width="50%" style={{ verticalAlign: "top" }}>
                                  <span
                                    style={{
                                      fontFamily: FONT_BODY,
                                      fontSize: "12px",
                                      color: COLORS.muted,
                                    }}
                                  >
                                    Seu lucro líquido real
                                  </span>
                                  <br />
                                  <span
                                    style={{
                                      fontFamily: FONT_HEADING,
                                      fontSize: "20px",
                                      fontWeight: 700,
                                      color: COLORS.success,
                                    }}
                                  >
                                    {formatBRL(
                                      report.totals.platformFeeCents -
                                        report.totals.mercadoPagoFeeCents,
                                    )}
                                  </span>
                                </td>
                                <td width="50%" style={{ verticalAlign: "top" }}>
                                  <span
                                    style={{
                                      fontFamily: FONT_BODY,
                                      fontSize: "12px",
                                      color: COLORS.muted,
                                    }}
                                  >
                                    A repassar aos organizadores
                                  </span>
                                  <br />
                                  <span
                                    style={{
                                      fontFamily: FONT_HEADING,
                                      fontSize: "20px",
                                      fontWeight: 700,
                                      color: COLORS.foreground,
                                    }}
                                  >
                                    {formatBRL(report.totals.netCents)}
                                  </span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              {/* Um cartão por organizador — quanto vendeu, e quanto você
                  precisa transferir pra ele hoje */}
              {report.organizers.map((org) => (
                <tr key={org.organizerId}>
                  <td style={{ paddingTop: "16px" }}>
                    <table
                      role="presentation"
                      width="100%"
                      cellPadding={0}
                      cellSpacing={0}
                      style={{
                        backgroundColor: COLORS.card,
                        border: `1px solid ${COLORS.cardBorder}`,
                        borderRadius: "14px",
                      }}
                    >
                      <tbody>
                        <tr>
                          <td style={{ padding: "18px 20px 4px" }}>
                            <span
                              style={{
                                fontFamily: FONT_HEADING,
                                fontSize: "16px",
                                fontWeight: 700,
                                color: COLORS.foreground,
                              }}
                            >
                              {org.organizerName}
                            </span>
                            {org.organizerEmail && (
                              <>
                                <br />
                                <span
                                  style={{
                                    fontFamily: FONT_MONO,
                                    fontSize: "12px",
                                    color: COLORS.muted,
                                  }}
                                >
                                  {org.organizerEmail}
                                </span>
                              </>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: "8px 20px 4px" }}>
                            {org.events.map((ev) => (
                              <div
                                key={ev.eventName}
                                style={{
                                  fontFamily: FONT_BODY,
                                  fontSize: "13px",
                                  color: COLORS.muted,
                                  padding: "2px 0",
                                }}
                              >
                                {ev.eventName} — {ev.quantity}× ·{" "}
                                {formatBRL(ev.grossCents)}
                              </div>
                            ))}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: "12px 20px 18px" }}>
                            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                              <tbody>
                                <tr>
                                  <td>
                                    <span
                                      style={{
                                        fontFamily: FONT_BODY,
                                        fontSize: "11px",
                                        color: COLORS.muted,
                                      }}
                                    >
                                      Vendeu (bruto)
                                    </span>
                                    <br />
                                    <span
                                      style={{
                                        fontFamily: FONT_MONO,
                                        fontSize: "14px",
                                        color: COLORS.foreground,
                                      }}
                                    >
                                      {formatBRL(org.grossCents)}
                                    </span>
                                  </td>
                                  <td>
                                    <span
                                      style={{
                                        fontFamily: FONT_BODY,
                                        fontSize: "11px",
                                        color: COLORS.muted,
                                      }}
                                    >
                                      Sua taxa (10%)
                                    </span>
                                    <br />
                                    <span
                                      style={{
                                        fontFamily: FONT_MONO,
                                        fontSize: "14px",
                                        color: COLORS.accent,
                                      }}
                                    >
                                      {formatBRL(org.platformFeeCents)}
                                    </span>
                                  </td>
                                  <td>
                                    <span
                                      style={{
                                        fontFamily: FONT_BODY,
                                        fontSize: "11px",
                                        color: COLORS.muted,
                                      }}
                                    >
                                      Você manda
                                    </span>
                                    <br />
                                    <span
                                      style={{
                                        fontFamily: FONT_MONO,
                                        fontSize: "14px",
                                        fontWeight: 700,
                                        color: COLORS.success,
                                      }}
                                    >
                                      {formatBRL(org.netCents)}
                                    </span>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              ))}
            </>
          )}

          <tr>
            <td style={{ padding: "20px 12px 0", textAlign: "center" }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: FONT_BODY,
                  fontSize: "11px",
                  color: COLORS.muted,
                }}
              >
                Relatório automático gerado às 22h (horário de Brasília).
                Cobre as vendas pagas desde a meia-noite de hoje.
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
