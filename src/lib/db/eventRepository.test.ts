import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../../tests/testDb";
import {
  createEvent,
  findEventForOrganizer,
  listEventsByOrganizer,
  updateEvent,
} from "./eventRepository";

describe("eventRepository", () => {
  let organizerAId: string;
  let organizerBId: string;

  beforeEach(async () => {
    await resetDatabase();
    const organizerA = await testPrisma.organizer.create({
      data: { name: "Organizador A", email: "a@organizador.dev" },
    });
    const organizerB = await testPrisma.organizer.create({
      data: { name: "Organizador B", email: "b@organizador.dev" },
    });
    organizerAId = organizerA.id;
    organizerBId = organizerB.id;
  });

  it("creates an event scoped to the organizer", async () => {
    const event = await createEvent(organizerAId, {
      name: "Show da Banda X",
      slug: "show-da-banda-x",
      location: "Curitiba, PR",
      startsAt: new Date("2026-11-01T21:00:00-03:00"),
      ticketPriceCents: 8000,
      capacity: 200,
    });

    expect(event.organizerId).toBe(organizerAId);
  });

  it("does not return another organizer's event", async () => {
    const event = await createEvent(organizerAId, {
      name: "Show da Banda X",
      slug: "show-da-banda-x-2",
      location: "Curitiba, PR",
      startsAt: new Date("2026-11-01T21:00:00-03:00"),
      ticketPriceCents: 8000,
      capacity: 200,
    });

    const foundByOwner = await findEventForOrganizer(organizerAId, event.id);
    const foundByOther = await findEventForOrganizer(organizerBId, event.id);

    expect(foundByOwner?.id).toBe(event.id);
    expect(foundByOther).toBeNull();
  });

  it("lists only events belonging to the given organizer", async () => {
    await createEvent(organizerAId, {
      name: "Evento A1",
      slug: "evento-a1",
      location: "São Paulo, SP",
      startsAt: new Date("2026-10-01T20:00:00-03:00"),
      ticketPriceCents: 3000,
      capacity: 50,
    });
    await createEvent(organizerBId, {
      name: "Evento B1",
      slug: "evento-b1",
      location: "Rio de Janeiro, RJ",
      startsAt: new Date("2026-10-05T20:00:00-03:00"),
      ticketPriceCents: 4000,
      capacity: 80,
    });

    const eventsForA = await listEventsByOrganizer(organizerAId);

    expect(eventsForA).toHaveLength(1);
    expect(eventsForA[0].slug).toBe("evento-a1");
  });

  it("returns null for an eventId that does not exist", async () => {
    const found = await findEventForOrganizer(
      organizerAId,
      crypto.randomUUID(),
    );

    expect(found).toBeNull();
  });

  describe("updateEvent", () => {
    beforeEach(async () => {
      await resetDatabase();
      const organizerA = await testPrisma.organizer.create({
        data: { name: "Organizador A", email: "a@organizador.dev" },
      });
      const organizerB = await testPrisma.organizer.create({
        data: { name: "Organizador B", email: "b@organizador.dev" },
      });
      organizerAId = organizerA.id;
      organizerBId = organizerB.id;
    });

    it("updates an event belonging to the organizer", async () => {
      const event = await createEvent(organizerAId, {
        name: "Nome Original",
        slug: "nome-original",
        location: "São Paulo, SP",
        startsAt: new Date("2026-10-01T20:00:00-03:00"),
        ticketPriceCents: 3000,
        capacity: 50,
      });

      const updated = await updateEvent(organizerAId, event.id, {
        name: "Nome Atualizado",
        location: "São Paulo, SP",
        startsAt: new Date("2026-10-01T20:00:00-03:00"),
        ticketPriceCents: 4000,
        capacity: 80,
        status: "PUBLISHED",
      });

      expect(updated).toBe(true);

      const fetched = await findEventForOrganizer(organizerAId, event.id);
      expect(fetched?.name).toBe("Nome Atualizado");
      expect(fetched?.ticketPriceCents).toBe(4000);
      expect(fetched?.status).toBe("PUBLISHED");
    });

    it("does not update another organizer's event", async () => {
      const event = await createEvent(organizerAId, {
        name: "Nome Original",
        slug: "nome-original-2",
        location: "São Paulo, SP",
        startsAt: new Date("2026-10-01T20:00:00-03:00"),
        ticketPriceCents: 3000,
        capacity: 50,
      });

      const updated = await updateEvent(organizerBId, event.id, {
        name: "Nome Hackeado",
        location: "São Paulo, SP",
        startsAt: new Date("2026-10-01T20:00:00-03:00"),
        ticketPriceCents: 4000,
        capacity: 80,
        status: "PUBLISHED",
      });

      expect(updated).toBe(false);

      const fetched = await findEventForOrganizer(organizerAId, event.id);
      expect(fetched?.name).toBe("Nome Original");
    });

    it("clears the description when null is passed", async () => {
      const event = await createEvent(organizerAId, {
        name: "Evento com descrição",
        slug: "evento-com-descricao",
        description: "Descrição original",
        location: "São Paulo, SP",
        startsAt: new Date("2026-10-01T20:00:00-03:00"),
        ticketPriceCents: 3000,
        capacity: 50,
      });

      await updateEvent(organizerAId, event.id, {
        name: event.name,
        description: null,
        location: event.location,
        startsAt: event.startsAt,
        ticketPriceCents: event.ticketPriceCents,
        capacity: event.capacity,
        status: "DRAFT",
      });

      const fetched = await findEventForOrganizer(organizerAId, event.id);
      expect(fetched?.description).toBeNull();
    });
  });
});
