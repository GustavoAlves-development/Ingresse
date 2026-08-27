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

export function PasswordResetEmail({
  userName,
  resetUrl,
}: {
  userName: string;
  resetUrl: string;
}) {
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
        style={{ maxWidth: "480px", margin: "0 auto" }}
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
                padding: "32px 28px",
                textAlign: "center",
              }}
            >
              <h1
                style={{
                  margin: "0 0 12px",
                  fontFamily: FONT_HEADING,
                  fontSize: "20px",
                  fontWeight: 700,
                  color: COLORS.foreground,
                }}
              >
                Redefinir sua senha
              </h1>
              <p
                style={{
                  margin: "0 0 24px",
                  fontFamily: FONT_BODY,
                  fontSize: "14px",
                  color: COLORS.muted,
                  lineHeight: 1.5,
                }}
              >
                Olá, {userName}. Recebemos um pedido pra redefinir a senha da
                sua conta. Clique no botão abaixo pra escolher uma nova senha
                — esse link é válido por 1 hora.
              </p>

              <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: "0 auto" }}>
                <tbody>
                  <tr>
                    <td
                      style={{
                        backgroundColor: COLORS.primary,
                        borderRadius: "8px",
                      }}
                    >
                      <a
                        href={resetUrl}
                        style={{
                          display: "inline-block",
                          padding: "12px 28px",
                          fontFamily: FONT_HEADING,
                          fontSize: "14px",
                          fontWeight: 700,
                          color: COLORS.primaryForeground,
                          textDecoration: "none",
                        }}
                      >
                        Escolher nova senha
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>

              <p
                style={{
                  margin: "24px 0 0",
                  fontFamily: FONT_BODY,
                  fontSize: "12px",
                  color: COLORS.muted,
                }}
              >
                Se você não pediu essa redefinição, pode ignorar este e-mail
                — sua senha continua a mesma.
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
