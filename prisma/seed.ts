import { EventStatus, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const organizer = await prisma.organizer.upsert({
    where: { email: "demo@organizador.test" },
    update: {},
    create: {
      name: "Organizador Demo",
      email: "demo@organizador.test",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@organizador.test" },
    update: {},
    create: {
      organizerId: organizer.id,
      name: "Admin Demo",
      email: "admin@organizador.test",
      // hash de senha real será definido na fase de autenticação
      passwordHash: "placeholder-hash-set-in-auth-phase",
      role: Role.ORGANIZER_ADMIN,
    },
  });

  await prisma.event.upsert({
    where: { slug: "evento-demo" },
    update: {},
    create: {
      organizerId: organizer.id,
      name: "Evento Demo",
      slug: "evento-demo",
      location: "São Paulo, SP",
      startsAt: new Date("2026-12-01T20:00:00-03:00"),
      ticketPriceCents: 5000,
      capacity: 100,
      status: EventStatus.DRAFT,
    },
  });

  console.log("Seed concluído:", { organizerId: organizer.id });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
