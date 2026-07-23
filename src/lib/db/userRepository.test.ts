import { beforeEach, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { resetDatabase, testPrisma } from "../../../tests/testDb";
import {
  createUser,
  findUserByEmail,
  findUserForOrganizer,
} from "./userRepository";

describe("userRepository", () => {
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

  it("creates a user scoped to the organizer", async () => {
    const user = await createUser(organizerAId, {
      name: "Staff A1",
      email: "staffa1@organizador.dev",
      passwordHash: "hash",
      role: Role.PORTARIA_STAFF,
    });

    expect(user.organizerId).toBe(organizerAId);
  });

  it("finds a user by email regardless of organizer", async () => {
    await createUser(organizerAId, {
      name: "Staff A1",
      email: "staffa1@organizador.dev",
      passwordHash: "hash",
      role: Role.PORTARIA_STAFF,
    });

    const found = await findUserByEmail("staffa1@organizador.dev");

    expect(found?.organizerId).toBe(organizerAId);
  });

  it("does not return another organizer's user", async () => {
    const user = await createUser(organizerAId, {
      name: "Staff A1",
      email: "staffa1@organizador.dev",
      passwordHash: "hash",
      role: Role.PORTARIA_STAFF,
    });

    const foundByOwner = await findUserForOrganizer(organizerAId, user.id);
    const foundByOther = await findUserForOrganizer(organizerBId, user.id);

    expect(foundByOwner?.id).toBe(user.id);
    expect(foundByOther).toBeNull();
  });
});
