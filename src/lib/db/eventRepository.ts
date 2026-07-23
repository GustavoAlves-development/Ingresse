import type { EventStatus } from "@prisma/client";
import { prisma } from "./prismaClient";

export type CreateEventInput = {
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

// Padrão OBRIGATÓRIO para toda busca tenant-scoped em fases futuras (Order,
// Ticket): sempre exigir organizerId E o id do recurso juntos via findFirst,
// nunca buscar por id isolado — evita vazamento de dado entre organizadores.
export async function findEventForOrganizer(
  organizerId: string,
  eventId: string,
) {
  return prisma.event.findFirst({
    where: { id: eventId, organizerId },
  });
}

export type UpdateEventInput = {
  name: string;
  description?: string | null;
  location: string;
  startsAt: Date;
  ticketPriceCents: number;
  capacity: number;
  status: EventStatus;
};

export async function updateEvent(
  organizerId: string,
  eventId: string,
  input: UpdateEventInput,
) {
  const result = await prisma.event.updateMany({
    where: { id: eventId, organizerId },
    data: input,
  });

  return result.count === 1;
}
