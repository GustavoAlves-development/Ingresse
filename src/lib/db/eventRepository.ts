import { prisma } from "./prismaClient";

type CreateEventInput = {
  name: string;
  slug: string;
  location: string;
  startsAt: Date;
  ticketPriceCents: number;
  capacity: number;
  description?: string;
  coverImageUrl?: string;
};

export async function createEvent(
  organizerId: string,
  input: CreateEventInput,
) {
  return prisma.event.create({
    data: { organizerId, ...input },
  });
}

export async function listEventsByOrganizer(organizerId: string) {
  return prisma.event.findMany({
    where: { organizerId },
    orderBy: { startsAt: "asc" },
  });
}

export async function findEventForOrganizer(
  organizerId: string,
  eventId: string,
) {
  return prisma.event.findFirst({
    where: { id: eventId, organizerId },
  });
}
