import { prisma } from "@/lib/db/prismaClient";

// Log de diagnóstico temporário, gravado direto no Postgres em vez de
// depender do console.log/Vercel Runtime Logs — nesse projeto o painel de
// Logs da Vercel não está exibindo NADA (nem pra requisições confirmadas,
// via X-Vercel-Id/X-Matched-Path, como tendo rodado), então não dá pra
// confiar nele por enquanto.
//
// Requer que a tabela abaixo já exista no banco (criar uma vez, manualmente,
// pelo SQL Editor do Neon):
//
//   CREATE TABLE IF NOT EXISTS webhook_debug_log (
//     id SERIAL PRIMARY KEY,
//     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
//     label TEXT NOT NULL,
//     payload JSONB
//   );
//
// Não usa uma migration do Prisma de propósito (é só uma tabela de debug,
// sem relação com o schema de domínio, e assim não precisa rodar
// `prisma migrate` sem ambiente local). Pode ser apagada quando o problema
// do e-mail estiver resolvido:
//
//   DROP TABLE IF EXISTS webhook_debug_log;
//
// Consultar com:
//
//   SELECT id, created_at, label, payload
//   FROM webhook_debug_log
//   ORDER BY created_at DESC
//   LIMIT 30;
export async function debugLog(label: string, payload: unknown = {}) {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO webhook_debug_log (label, payload) VALUES ($1, $2::jsonb)`,
      label,
      JSON.stringify(payload ?? {}),
    );
  } catch (err) {
    // Nunca deixamos uma falha no log de diagnóstico derrubar o fluxo real
    // do webhook. Se a tabela ainda não existir, isso vai cair aqui.
    console.error("[debugLog] falha ao gravar log de diagnóstico", {
      label,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
