import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../tests/testDb";
import { createOrganizer, findOrganizerById } from "./organizerRepository";

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
