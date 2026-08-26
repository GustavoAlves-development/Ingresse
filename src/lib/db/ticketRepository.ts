import type { CheckInResult, Ticket } from "@prisma/client";
import { prisma } from "./prismaClient";

export async function validateTicketForOrganizer(
  organizerId: string,
  qrToken: string,
  staffUserId: string,
): Promise<{ result: CheckInResult; ticket: Ticket | null }> {
  // UPDATE atômico condicional: uma única instrução SQL faz o check-and-set.
  // O Postgres serializa via row lock implícito do próprio UPDATE — se duas
  // leituras concorrentes chegarem com o mesmo qrToken, só uma encontra
  // status = 'VALID' e afeta a linha (spec, seção 6). Escopar por
  // organizerId dentro do próprio UPDATE (não só depois) impede que staff
  // de um organizador valide — ou apenas descubra a existência de — um
  // ingresso de outro tenant.
  const updatedTickets = await prisma.$queryRaw<Ticket[]>`
    UPDATE "Ticket"
    SET "status" = 'USED', "usedAt" = now(), "usedByUserId" = ${staffUserId}
    WHERE "qrToken" = ${qrToken} AND "organizerId" = ${organizerId} AND "status" = 'VALID'
    RETURNING *
  `;
  const updatedTicket = updatedTickets[0];

  if (updatedTicket) {
    await prisma.checkInAttempt.create({
      data: {
        ticketId: updatedTicket.id,
        scannedByUserId: staffUserId,
        result: "SUCCESS",
      },
    });
    return { result: "SUCCESS", ticket: updatedTicket };
  }

  // updatedTicket vazio: token não existe para este organizador OU já foi
  // usado. Esta leitura extra só decide a mensagem — o UPDATE atômico acima
  // já decidiu o resultado real, não há race condition aqui (mesmo padrão
  // documentado na spec, seção 6).
  const existing = await prisma.ticket.findFirst({
    where: { qrToken, organizerId },
  });

  const result: CheckInResult = existing ? "ALREADY_USED" : "INVALID";
  if (existing) {
    await prisma.checkInAttempt.create({
      data: { ticketId: existing.id, scannedByUserId: staffUserId, result },
    });
  }

  return { result, ticket: existing };
}

// Mesmo fluxo de validateTicketForOrganizer, mas SEM o filtro de
// organizerId no UPDATE/leitura — usada exclusivamente quando o chamador
// já foi confirmado como dono da plataforma (getPlatformOwnerSession),
// pra ele conseguir validar ingresso de portaria de QUALQUER organizador.
// Função separada de propósito: nunca reutilizar/alterar
// validateTicketForOrganizer pra adicionar esse bypass ali dentro — a
// isolação por tenant daquela função precisa continuar sempre absoluta.
export async function validateTicketAsPlatformOwner(
  qrToken: string,
  staffUserId: string,
): Promise<{ result: CheckInResult; ticket: Ticket | null }> {
  const updatedTickets = await prisma.$queryRaw<Ticket[]>`
    UPDATE "Ticket"
    SET "status" = 'USED', "usedAt" = now(), "usedByUserId" = ${staffUserId}
    WHERE "qrToken" = ${qrToken} AND "status" = 'VALID'
    RETURNING *
  `;
  const updatedTicket = updatedTickets[0];

  if (updatedTicket) {
    await prisma.checkInAttempt.create({
      data: {
        ticketId: updatedTicket.id,
        scannedByUserId: staffUserId,
        result: "SUCCESS",
      },
    });
    return { result: "SUCCESS", ticket: updatedTicket };
  }

  const existing = await prisma.ticket.findFirst({ where: { qrToken } });

  const result: CheckInResult = existing ? "ALREADY_USED" : "INVALID";
  if (existing) {
    await prisma.checkInAttempt.create({
      data: { ticketId: existing.id, scannedByUserId: staffUserId, result },
    });
  }

  return { result, ticket: existing };
}
