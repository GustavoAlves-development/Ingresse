import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Carrega o banco de TESTE (branch separado do Neon) antes de qualquer
// módulo que use o Prisma Client ser importado, para nunca rodar testes
// contra o banco de desenvolvimento.
config({ path: ".env.test" });

export default defineConfig({
  test: {
    environment: "node",
    env: {
      DATABASE_URL: process.env.DATABASE_URL,
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
