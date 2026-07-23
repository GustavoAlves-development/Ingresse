import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config, parse } from "dotenv";
import { defineConfig } from "vitest/config";

// Carrega o banco de TESTE (branch separado do Neon) antes de qualquer
// módulo que use o Prisma Client ser importado, para nunca rodar testes
// contra o banco de desenvolvimento. `override: true` é obrigatório aqui:
// sem isso, um DATABASE_URL já presente no ambiente (shell, CI) venceria
// silenciosamente e os testes rodariam contra o banco errado.
config({ path: ".env.test", override: true });

const testDatabaseUrl = process.env.DATABASE_URL;

let devDatabaseUrl: string | undefined;
try {
  devDatabaseUrl = parse(readFileSync(".env")).DATABASE_URL;
} catch {
  // .env pode não existir em alguns ambientes (ex: CI) — nada a comparar.
}

if (devDatabaseUrl && devDatabaseUrl === testDatabaseUrl) {
  throw new Error(
    "DATABASE_URL em .env.test é idêntico ao de .env (banco de desenvolvimento). " +
      "Os testes chamam resetDatabase(), que apaga todas as linhas — " +
      "recusando rodar contra o banco de desenvolvimento.",
  );
}

export default defineConfig({
  test: {
    environment: "node",
    env: {
      DATABASE_URL: process.env.DATABASE_URL,
    },
    // Todos os arquivos de teste compartilham o mesmo banco Postgres real
    // (branch de teste do Neon) e chamam resetDatabase() no beforeEach.
    // Sem isso, o Vitest roda arquivos de teste em paralelo por padrão e
    // um arquivo pode apagar as linhas que outro acabou de criar,
    // causando falhas intermitentes (race condition entre arquivos).
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
