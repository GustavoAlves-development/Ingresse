import { beforeEach, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { resetDatabase, testPrisma } from "../../../tests/testDb";
import { hashPassword } from "./password";
import { verifyCredentials } from "./verifyCredentials";

describe("verifyCredentials", () => {
  let organizerId: string;

  beforeEach(async () => {
    await resetDatabase();
    const organizer = await testPrisma.organizer.create({
      data: { name: "Organizador Teste", email: "org@teste.dev" },
    });
    organizerId = organizer.id;
    const passwordHash = await hashPassword("senhaCorreta123");
    await testPrisma.user.create({
      data: {
        organizerId,
        name: "Usuário Teste",
        email: "user@teste.dev",
        passwordHash,
        role: Role.ORGANIZER_ADMIN,
      },
    });
  });

  it("returns the user when email and password match", async () => {
    const result = await verifyCredentials(
      "user@teste.dev",
      "senhaCorreta123",
    );

    expect(result?.email).toBe("user@teste.dev");
    expect(result?.organizerId).toBe(organizerId);
  });

  it("returns null when the password is wrong", async () => {
    const result = await verifyCredentials("user@teste.dev", "senhaErrada");

    expect(result).toBeNull();
  });

  it("returns null when the email does not exist", async () => {
    const result = await verifyCredentials("naoexiste@teste.dev", "qualquer");

    expect(result).toBeNull();
  });
});
