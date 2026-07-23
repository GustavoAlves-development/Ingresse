import { describe, expect, it } from "vitest";
import { generateQrToken } from "./qrToken";

describe("generateQrToken", () => {
  it("generates a 32-character opaque token", () => {
    const token = generateQrToken();

    expect(token).toHaveLength(32);
  });

  it("generates a different token on each call", () => {
    const first = generateQrToken();
    const second = generateQrToken();

    expect(first).not.toBe(second);
  });
});
