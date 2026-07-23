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
