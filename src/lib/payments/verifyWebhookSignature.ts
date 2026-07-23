import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMercadoPagoSignature(params: {
  xSignature: string;
  xRequestId: string;
  dataId: string;
  webhookSecret: string;
}): boolean {
  const { xSignature, xRequestId, dataId, webhookSecret } = params;

  if (!webhookSecret) {
    return false;
  }

  const signatureParts = Object.fromEntries(
    xSignature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );

  const timestamp = signatureParts.ts;
  const receivedHash = signatureParts.v1;
  if (!timestamp || !receivedHash) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${timestamp};`;
  const expectedHash = createHmac("sha256", webhookSecret)
    .update(manifest)
    .digest("hex");

  if (receivedHash.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(receivedHash), Buffer.from(expectedHash));
}
