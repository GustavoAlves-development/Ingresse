import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMercadoPagoSignature } from "./verifyWebhookSignature";

const webhookSecret = "test-secret";

function buildSignature(
  dataId: string,
  requestId: string,
  ts: string,
  secret: string,
) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${hash}`;
}

describe("verifyMercadoPagoSignature", () => {
  it("accepts a correctly signed notification", () => {
    const xSignature = buildSignature("123", "req-1", "1700000000", webhookSecret);

    const result = verifyMercadoPagoSignature({
      xSignature,
      xRequestId: "req-1",
      dataId: "123",
      webhookSecret,
    });

    expect(result).toBe(true);
  });

  it("rejects a signature signed with the wrong secret", () => {
    const xSignature = buildSignature(
      "123",
      "req-1",
      "1700000000",
      "wrong-secret",
    );

    const result = verifyMercadoPagoSignature({
      xSignature,
      xRequestId: "req-1",
      dataId: "123",
      webhookSecret,
    });

    expect(result).toBe(false);
  });

  it("rejects when the dataId does not match what was signed", () => {
    const xSignature = buildSignature("123", "req-1", "1700000000", webhookSecret);

    const result = verifyMercadoPagoSignature({
      xSignature,
      xRequestId: "req-1",
      dataId: "999",
      webhookSecret,
    });

    expect(result).toBe(false);
  });

  it("rejects a malformed x-signature header", () => {
    const result = verifyMercadoPagoSignature({
      xSignature: "not-a-valid-header",
      xRequestId: "req-1",
      dataId: "123",
      webhookSecret,
    });

    expect(result).toBe(false);
  });
});
