import { describe, expect, it } from "vitest";
import { generateQrCodeDataUrl } from "./qrCode";

describe("generateQrCodeDataUrl", () => {
  it("generates a PNG data URL for a token", async () => {
    const dataUrl = await generateQrCodeDataUrl("some-opaque-token-12345678901234");

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
