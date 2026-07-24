import { prisma } from "./prismaClient";

type CreateAttractionInput = {
  name: string;
  photoUrl?: string;
};

export async function createAttraction(
  eventId: string,
  organizerId: string,
  input: CreateAttractionInput,
) {
  return prisma.attraction.create({
    data: { eventId, organizerId, ...input },
  });
}

// Padrão canônico de tenant-scoping (mesmo de updateEvent): organizerId e o
// id do recurso juntos na mesma query, nunca por id isolado. organizerId
// está denormalizado em Attraction, então não precisa de join até Event.
export async function deleteAttractionForOrganizer(
  organizerId: string,
  attractionId: string,
): Promise<boolean> {
  const result = await prisma.attraction.deleteMany({
    where: { id: attractionId, organizerId },
  });

  return result.count === 1;
}
