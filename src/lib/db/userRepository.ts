import type { Role } from "@prisma/client";
import { prisma } from "./prismaClient";

type CreateUserInput = {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
};

export async function createUser(organizerId: string, input: CreateUserInput) {
  return prisma.user.create({ data: { organizerId, ...input } });
}

// Busca global por e-mail — necessária para o login, que acontece antes de
// sabermos a qual organizerId o usuário pertence. E-mail é @unique no
// schema, então essa busca não vaza dado de outro tenant: cada e-mail
// pertence a exatamente um usuário/organizador.
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

// Padrão canônico de tenant-scoping (mesmo de findEventForOrganizer, Fase
// 1): sempre exige organizerId E o id do recurso juntos via findFirst,
// nunca busca por id isolado — evita vazamento de dado entre organizadores.
export async function findUserForOrganizer(
  organizerId: string,
  userId: string,
) {
  return prisma.user.findFirst({ where: { id: userId, organizerId } });
}

export async function listUsersByOrganizer(organizerId: string) {
  return prisma.user.findMany({
    where: { organizerId },
    orderBy: { createdAt: "asc" },
  });
}

// "Esqueci a senha": grava um token de uso único com validade curta.
// Sempre sobrescreve qualquer token anterior desse usuário (um pedido novo
// invalida o link antigo).
export async function setPasswordResetToken(
  userId: string,
  token: string,
  expiresAt: Date,
) {
  return prisma.user.update({
    where: { id: userId },
    data: { passwordResetToken: token, passwordResetExpiresAt: expiresAt },
  });
}

// Busca só por token — nunca aceita token expirado (comparação de data
// direto na query, não depois). Retorna null tanto pra "token não existe"
// quanto pra "token expirado", de propósito: o chamador não precisa (e não
// deve) diferenciar os dois casos pro usuário.
export async function findUserByValidResetToken(token: string) {
  return prisma.user.findFirst({
    where: { passwordResetToken: token, passwordResetExpiresAt: { gt: new Date() } },
  });
}

// Troca a senha e invalida o token (uso único) na mesma operação.
export async function resetPassword(userId: string, passwordHash: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    },
  });
}
