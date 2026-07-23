import { nanoid } from "nanoid";

export function generateQrToken(): string {
  return nanoid(32);
}
