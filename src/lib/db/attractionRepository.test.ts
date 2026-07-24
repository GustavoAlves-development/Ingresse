import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../../tests/testDb";
import {
  createAttraction,
  deleteAttractionForOrganizer,
} from "./attractionRepository";

describe("attractionRepository", () => {
  let organizerId: string;
  let eventId: string;

  beforeEach(async () => {
    await resetDatabase();
    const organizer = await testPrisma.organizer.create({
      data: { name: "Organizador Teste", email: "org@teste.dev" },
    });
    organizerId = organizer.id;
    const event = await testPrisma.event.create({
      data: {
        organizerId,
        name: "Show de Teste",
        slug: "show-attraction-teste",
        location: "São Paulo, SP",
        startsAt: new Date("2026-12-01T23:00:00.000Z"),
        ticketPriceCents: 5000,
        capacity: 100,
        status: "PUBLISHED",
      },
    });
    eventId = event.id;
  });

  describe("createAttraction", () => {
    it("creates an attraction with organizerId denormalized from the event", async () => {
      const attraction = await createAttraction(eventId, organizerId, {
        name: "DJ Teste",
        photoUrl: "https://example.com/dj.jpg",
      });

      expect(attraction.name).toBe("DJ Teste");
      expect(attraction.eventId).toBe(eventId);
      expect(attraction.organizerId).toBe(organizerId);
      expect(attraction.photoUrl).toBe("https://example.com/dj.jpg");
    });

    it("creates an attraction without a photo", async () => {
      const attraction = await createAttraction(eventId, organizerId, {
        name: "DJ Sem Foto",
      });

      expect(attraction.photoUrl).toBeNull();
    });
  });

  describe("deleteAttractionForOrganizer", () => {
    it("deletes an attraction that belongs to the organizer", async () => {
      const attraction = await createAttraction(eventId, organizerId, {
        name: "DJ Teste",
      });

      const deleted = await deleteAttractionForOrganizer(
        organizerId,
        attraction.id,
      );

      expect(deleted).toBe(true);
      const found = await testPrisma.attraction.findUnique({
        where: { id: attraction.id },
      });
      expect(found).toBeNull();
    });

    it("does not delete an attraction that belongs to another organizer", async () => {
      const otherOrganizer = await testPrisma.organizer.create({
        data: { name: "Outro Organizador", email: "outro@teste.dev" },
      });
      const attraction = await createAttraction(eventId, organizerId, {
        name: "DJ Teste",
      });

      const deleted = await deleteAttractionForOrganizer(
        otherOrganizer.id,
        attraction.id,
      );

      expect(deleted).toBe(false);
      const found = await testPrisma.attraction.findUnique({
        where: { id: attraction.id },
      });
      expect(found).not.toBeNull();
    });

    it("returns false for a nonexistent attractionId", async () => {
      const deleted = await deleteAttractionForOrganizer(
        organizerId,
        crypto.randomUUID(),
      );

      expect(deleted).toBe(false);
    });
  });
});
