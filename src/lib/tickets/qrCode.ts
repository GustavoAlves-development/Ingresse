import QRCode from "qrcode";

export async function generateQrCodeDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token);
}
