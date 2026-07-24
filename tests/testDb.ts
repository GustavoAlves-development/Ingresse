import { prisma } from "@/lib/db/prismaClient";

export { prisma as testPrisma };

export async function resetDatabase() {
  await prisma.checkInAttempt.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.order.deleteMany();
  await prisma.attraction.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organizer.deleteMany();
}
