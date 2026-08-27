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

  const blob = await putWithRetry(`tickets/qr/${token}.png`, buffer);

  // "Esquenta" a URL antes do e-mail sair: confirma que o arquivo já está
  // de fato acessível na CDN antes que o cliente de e-mail (Gmail etc)
  // tente buscar a imagem pela primeira vez. Sem isso, numa janela rara de
  // propagação, o primeiro fetch do próprio Gmail pode falhar — e o Gmail
  // cacheia esse fetch falho como "imagem quebrada" por um bom tempo,
  // mesmo depois do arquivo já estar disponível. É provavelmente essa a
  // causa do QR "bugar" de vez em quando.
  await warmUpUrl(blob.url);

  return blob.url;
}

async function putWithRetry(path: string, buffer: Buffer, attempt = 1): Promise<{ url: string }> {
  try {
    return await put(path, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/png",
      cacheControlMaxAge: 31536000, // 1 ano — a imagem nunca muda pro mesmo token
    });
  } catch (err) {
    if (attempt >= 3) throw err;
    await sleep(300 * attempt);
    return putWithRetry(path, buffer, attempt + 1);
  }
}

async function warmUpUrl(url: string) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) return;
    } catch {
      // ignora e tenta de novo abaixo, ou desiste silenciosamente na
      // última tentativa — nunca deve impedir o e-mail de ser enviado.
    }
    await sleep(400 * attempt);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
