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
