import { Role } from "@prisma/client";
import { prisma } from "./prismaClient";

export async function createOrganizer(input: {
  name: string;
  email: string;
  document?: string;
  logoUrl?: string;
}) {
  return prisma.organizer.create({ data: input });
}

export async function findOrganizerById(organizerId: string) {
  return prisma.organizer.findUnique({ where: { id: organizerId } });
}

// Usado pelo relatório diário: os pedidos trazem só organizerId, então
// depois de agrupar as vendas por organizador buscamos nome/e-mail de
// todos de uma vez, em vez de uma query por organizador.
export async function listOrganizersByIds(organizerIds: string[]) {
  if (organizerIds.length === 0) return [];
  return prisma.organizer.findMany({
    where: { id: { in: organizerIds } },
  });
}

export async function createOrganizerWithAdminUser(input: {
  organizerName: string;
  organizerEmail: string;
  adminName: string;
  adminEmail: string;
  passwordHash: string;
}) {
  return prisma.$transaction(async (tx) => {
    const organizer = await tx.organizer.create({
      data: { name: input.organizerName, email: input.organizerEmail },
    });

    const adminUser = await tx.user.create({
      data: {
        organizerId: organizer.id,
        name: input.adminName,
        email: input.adminEmail,
        passwordHash: input.passwordHash,
        role: Role.ORGANIZER_ADMIN,
      },
    });

    return { organizer, adminUser };
  });
}
