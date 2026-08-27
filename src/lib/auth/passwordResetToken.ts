import { nanoid } from "nanoid";

export function generatePasswordResetToken(): string {
  return nanoid(40);
}

// 1 hora de validade — curto o suficiente pra reduzir a janela de uso
// indevido se o e-mail for interceptado, longo o suficiente pra não
// irritar quem demora um pouco pra abrir o e-mail.
export function getPasswordResetExpiry(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}
