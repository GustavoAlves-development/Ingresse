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
  confirmedAttendees?: number;
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

// Padrão OBRIGATÓRIO para toda busca tenant-scoped: sempre exigir
// organizerId E o id do recurso juntos via findFirst, nunca buscar por id
// isolado — evita vazamento de dado entre organizadores.
export async function findEventForOrganizer(
  organizerId: string,
  eventId: string,
) {
  return prisma.event.findFirst({
    where: { id: eventId, organizerId },
    include: { attractions: { orderBy: { createdAt: "asc" } } },
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
  coverImageUrl?: string | null;
  confirmedAttendees?: number | null;
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

// Lookup por id sem escopo de organizador — uso restrito a processos de
// sistema (webhook, checkout) que já obtiveram o eventId de um registro
// nosso confiável (nunca de input de sessão de usuário tentando acessar
// dado de outro tenant). Não use isso a partir de uma rota que recebe
// eventId vindo de uma sessão autenticada — use findEventForOrganizer.
export async function findEventById(eventId: string) {
  return prisma.event.findUnique({ where: { id: eventId } });
}

// Lookup público por slug — qualquer visitante pode ver um evento
// publicado pelo slug (é o propósito da página pública de vendas).
export async function findEventBySlug(slug: string) {
  return prisma.event.findUnique({
    where: { slug },
    include: { attractions: { orderBy: { createdAt: "asc" } } },
  });
}

export type PlatformEventFilters = {
  organizerId?: string;
  status?: EventStatus;
  search?: string;
  startsAtFrom?: Date;
  startsAtTo?: Date;
};

// Sem escopo de tenant de propósito — traz eventos de TODOS os
// organizadores. Só usado pelo dashboard de plataforma
// (/admin/platform), já protegido por getPlatformOwnerSession antes de
// qualquer chamada chegar aqui. Inclui os pedidos pagos de cada evento
// pra computar receita/comissão sem uma query extra por evento.
export async function listAllEventsForPlatform(filters: PlatformEventFilters) {
  return prisma.event.findMany({
    where: {
      ...(filters.organizerId ? { organizerId: filters.organizerId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? { name: { contains: filters.search, mode: "insensitive" } }
        : {}),
      ...(filters.startsAtFrom || filters.startsAtTo
        ? {
            startsAt: {
              ...(filters.startsAtFrom ? { gte: filters.startsAtFrom } : {}),
              ...(filters.startsAtTo ? { lte: filters.startsAtTo } : {}),
            },
          }
        : {}),
    },
    include: {
      organizer: { select: { id: true, name: true } },
      orders: {
        where: { status: "PAID" },
        select: { totalAmountCents: true, quantity: true },
      },
      _count: { select: { tickets: { where: { status: { not: "CANCELLED" } } } } },
    },
    orderBy: { startsAt: "desc" },
  });
}
