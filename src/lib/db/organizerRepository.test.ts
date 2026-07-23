import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../../tests/testDb";
import {
  createOrganizer,
  createOrganizerWithAdminUser,
  findOrganizerById,
} from "./organizerRepository";

describe("organizerRepository", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates an organizer and finds it by id", async () => {
    const created = await createOrganizer({
      name: "Organizador Teste",
      email: "teste@organizador.dev",
    });

    const found = await findOrganizerById(created.id);

    expect(found).not.toBeNull();
    expect(found?.email).toBe("teste@organizador.dev");
  });

  it("returns null for an id that does not exist", async () => {
    const found = await findOrganizerById(crypto.randomUUID());

    expect(found).toBeNull();
  });
});

describe("createOrganizerWithAdminUser", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates an organizer and its first admin user together", async () => {
    const result = await createOrganizerWithAdminUser({
      organizerName: "Organizador Completo",
      organizerEmail: "completo@organizador.dev",
      adminName: "Admin Completo",
      adminEmail: "completo@organizador.dev",
      passwordHash: "hash",
    });

    expect(result.organizer.name).toBe("Organizador Completo");
    expect(result.adminUser.organizerId).toBe(result.organizer.id);
    expect(result.adminUser.role).toBe(Role.ORGANIZER_ADMIN);
  });

  it("throws when the email is already in use", async () => {
    await createOrganizerWithAdminUser({
      organizerName: "Organizador 1",
      organizerEmail: "duplicado@organizador.dev",
      adminName: "Admin 1",
      adminEmail: "duplicado@organizador.dev",
      passwordHash: "hash",
    });

    await expect(
      createOrganizerWithAdminUser({
        organizerName: "Organizador 2",
        organizerEmail: "duplicado@organizador.dev",
        adminName: "Admin 2",
        adminEmail: "duplicado@organizador.dev",
        passwordHash: "hash",
      }),
    ).rejects.toThrow();
  });

  it("rolls back organizer creation when the admin user's email is already in use", async () => {
    await createOrganizerWithAdminUser({
      organizerName: "Organizador Existente",
      organizerEmail: "existente@organizador.dev",
      adminName: "Admin Existente",
      adminEmail: "conflito@organizador.dev",
      passwordHash: "hash",
    });

    await expect(
      createOrganizerWithAdminUser({
        organizerName: "Organizador Novo",
        organizerEmail: "novo-unico@organizador.dev",
        adminName: "Admin Novo",
        adminEmail: "conflito@organizador.dev",
        passwordHash: "hash",
      }),
    ).rejects.toThrow();

    const orphanOrganizer = await testPrisma.organizer.findUnique({
      where: { email: "novo-unico@organizador.dev" },
    });
    expect(orphanOrganizer).toBeNull();
  });
});
