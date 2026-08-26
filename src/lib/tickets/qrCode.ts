import { put } from "@vercel/blob";
import QRCode from "qrcode";

// Gmail e boa parte dos outros clientes de e-mail bloqueiam/removem
// imagens embutidas como data: URI (base64 inline) por segurança — elas não
// passam pelo proxy de imagens deles. Por isso geramos o QR como PNG de
// verdade e subimos pro Vercel Blob, retornando uma URL pública normal que
// qualquer cliente de e-mail consegue carregar.
export async function generateQrCodeUrl(token: string): Promise<string> {
  const buffer = await QRCode.toBuffer(token, {
    type: "png",
    width: 480,
    margin: 2,
  });

  const blob = await put(`tickets/qr/${token}.png`, buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType: "image/png",
  });

  return blob.url;
}
