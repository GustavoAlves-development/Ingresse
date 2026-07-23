import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("hashes a password and verifies it matches", async () => {
    const hash = await hashPassword("supersecret123");

    const matches = await verifyPassword("supersecret123", hash);

    expect(matches).toBe(true);
  });

  it("rejects an incorrect password against the hash", async () => {
    const hash = await hashPassword("supersecret123");

    const matches = await verifyPassword("wrongpassword", hash);

    expect(matches).toBe(false);
  });

  it("produces a hash different from the plain password", async () => {
    const hash = await hashPassword("supersecret123");

    expect(hash).not.toBe("supersecret123");
  });
});
