# Fase 1 — Fundação: Scaffold Next.js + Prisma + Isolamento Multi-Tenant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ter um projeto Next.js rodando com TypeScript + Tailwind, schema Prisma completo migrado num Postgres (Neon), e uma camada de acesso a dados (repositórios) que prova, com testes automatizados, que o isolamento multi-tenant por `organizerId` funciona corretamente.

**Architecture:** Next.js (App Router) full-stack em TypeScript. Prisma como ORM sobre Postgres (Neon). Camada de repositório (`src/lib/db/*Repository.ts`) como único ponto de acesso ao banco — toda função de repositório que lida com dado pertencente a um organizador recebe `organizerId` explicitamente e filtra por ele, nunca busca por id isolado.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Prisma 5 + `@prisma/client`, Postgres via Neon, Vitest para testes.

## Global Constraints

- Nomenclatura obrigatória em todo o projeto: **camelCase** para variáveis, funções, rotas e colunas de banco de dados. (spec, seção 1)
- Isolamento multi-tenant é **row-level via coluna `organizerId`**, denormalizada em `Order` e `Ticket` (não apenas em `Event`), para permitir filtro direto sem join. (spec, seção 2 e 4)
- Todo acesso ao banco passa pelo Prisma — nunca SQL cru sem identificadores entre aspas, para preservar as colunas camelCase no Postgres. (spec, seção 4)
- Banco: Postgres via Neon. ORM: Prisma. (spec, seção 2)

## Escopo desta fase

Esta é a Fase 1 de um plano em múltiplas fases (spec completa em `docs/superpowers/specs/2026-07-23-saas-ingressos-design.md`). Cobre apenas: scaffold do projeto, schema Prisma + migração inicial, e a camada de repositório para `Organizer` e `Event` com testes de isolamento multi-tenant. **Não** cobre (ficam para planos seguintes): autenticação (Auth.js), CRUD de eventos via UI/API, checkout/webhook do Mercado Pago, geração/envio de QR Code, scanner de portaria, tema visual. Ao final desta fase, o projeto roda (`npm run dev`), compila (`npm run build`) e tem testes automatizados passando (`npm test`) provando o isolamento de tenant — uma entrega funcional e testável por si só.

---

### Task 1: Scaffold do projeto Next.js + TypeScript + Tailwind

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `.gitignore`

**Interfaces:**
- Produces: projeto Next.js executável via `npm run dev` / `npm run build`; alias de import `@/*` apontando para `src/*` (usado por todas as tasks seguintes).

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "ingresse",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@prisma/client": "^5.22.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "prisma": "^5.22.0",
    "vitest": "^2.1.0",
    "tsx": "^4.19.0",
    "dotenv": "^16.4.0"
  }
}
```

- [ ] **Step 2: Instalar dependências**

Run: `npm install`
Expected: instalação conclui sem erros, cria `node_modules/` e `package-lock.json`.

- [ ] **Step 3: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Criar `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 5: Criar `postcss.config.mjs` (Tailwind v4)**

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 6: Criar `src/app/globals.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 7: Criar `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plataforma de Ingressos",
  description: "SaaS de venda de ingressos e controle de portaria",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#0a0a0f] text-white antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Criar `src/app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-semibold">Plataforma de Ingressos</h1>
    </main>
  );
}
```

- [ ] **Step 9: Criar `.gitignore`**

```
node_modules
.next
.env
.env.test
*.log
```

- [ ] **Step 10: Verificar que o projeto compila**

Run: `npm run build`
Expected: build conclui com sucesso (saída contendo `Compiled successfully`), sem erros de TypeScript.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs src/app .gitignore
git commit -m "chore: scaffold Next.js project with TypeScript and Tailwind"
```

---

### Task 2: Schema Prisma + migração inicial

**Pré-requisito (ação manual sua, fora do código):**
1. Criar um projeto gratuito em https://neon.tech.
2. Criar dois branches de banco: um para desenvolvimento (`main`, por exemplo) e outro para testes (`test`, por exemplo — o Neon permite branch de banco em segundos).
3. Copiar a connection string do branch de dev para um arquivo `.env` na raiz do projeto: `DATABASE_URL="postgresql://...sslmode=require"`.
4. Copiar a connection string do branch de teste para um arquivo `.env.test` na raiz do projeto: `DATABASE_URL="postgresql://...sslmode=require"`.

Nenhum desses dois arquivos deve ser commitado (já estão no `.gitignore` do Task 1).

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env.example`

**Interfaces:**
- Produces: modelos Prisma `Organizer`, `User`, `Role`, `Event`, `EventStatus`, `Order`, `OrderStatus`, `Ticket`, `TicketStatus`, `CheckInAttempt`, `CheckInResult` — usados por todas as tasks e fases seguintes.

- [ ] **Step 1: Criar `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Organizer {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  document  String?
  logoUrl   String?
  createdAt DateTime @default(now())

  users  User[]
  events Event[]
}

enum Role {
  ORGANIZER_ADMIN
  PORTARIA_STAFF
}

model User {
  id           String   @id @default(uuid())
  organizerId  String
  name         String
  email        String   @unique
  passwordHash String
  role         Role     @default(PORTARIA_STAFF)
  createdAt    DateTime @default(now())

  organizer       Organizer        @relation(fields: [organizerId], references: [id])
  checkInAttempts CheckInAttempt[]

  @@index([organizerId])
}

enum EventStatus {
  DRAFT
  PUBLISHED
  CLOSED
}

model Event {
  id               String      @id @default(uuid())
  organizerId      String
  name             String
  slug             String      @unique
  description      String?
  location         String
  startsAt         DateTime
  ticketPriceCents Int
  capacity         Int
  status           EventStatus @default(DRAFT)
  coverImageUrl    String?
  createdAt        DateTime    @default(now())

  organizer Organizer @relation(fields: [organizerId], references: [id])
  orders    Order[]
  tickets   Ticket[]

  @@index([organizerId])
}

enum OrderStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

model Order {
  id                      String      @id @default(uuid())
  organizerId             String
  eventId                 String
  buyerName               String
  buyerEmail              String
  quantity                Int
  totalAmountCents        Int
  status                  OrderStatus @default(PENDING)
  mercadoPagoPaymentId    String?     @unique
  mercadoPagoPreferenceId String?
  paidAt                  DateTime?
  createdAt               DateTime    @default(now())

  event   Event    @relation(fields: [eventId], references: [id])
  tickets Ticket[]

  @@index([eventId])
  @@index([organizerId])
}

enum TicketStatus {
  VALID
  USED
  CANCELLED
}

model Ticket {
  id           String       @id @default(uuid())
  organizerId  String
  eventId      String
  orderId      String
  qrToken      String       @unique
  status       TicketStatus @default(VALID)
  buyerName    String
  usedAt       DateTime?
  usedByUserId String?
  createdAt    DateTime     @default(now())

  event           Event            @relation(fields: [eventId], references: [id])
  order           Order            @relation(fields: [orderId], references: [id])
  checkInAttempts CheckInAttempt[]

  @@index([eventId])
  @@index([qrToken])
  @@index([organizerId])
}

enum CheckInResult {
  SUCCESS
  ALREADY_USED
  INVALID
}

model CheckInAttempt {
  id              String        @id @default(uuid())
  ticketId        String
  scannedByUserId String
  result          CheckInResult
  scannedAt       DateTime      @default(now())

  ticket    Ticket @relation(fields: [ticketId], references: [id])
  scannedBy User   @relation(fields: [scannedByUserId], references: [id])

  @@index([ticketId])
}
```

- [ ] **Step 2: Criar `.env.example` (documentação, sem segredos reais)**

```
# Connection string do branch de desenvolvimento do Neon
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
```

- [ ] **Step 3: Rodar a migração inicial**

Run: `npx prisma migrate dev --name init`
Expected: saída terminando em `Your database is now in sync with your schema.` e criação de `prisma/migrations/<timestamp>_init/migration.sql`. O comando também gera o Prisma Client automaticamente.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations .env.example
git commit -m "feat: add Prisma schema and initial migration"
```

---

### Task 3: Cliente Prisma singleton + seed de dados de teste manual

**Files:**
- Create: `src/lib/db/prismaClient.ts`
- Create: `prisma/seed.ts`

**Interfaces:**
- Consumes: `PrismaClient` gerado a partir de `prisma/schema.prisma` (Task 2).
- Produces: `export const prisma` em `src/lib/db/prismaClient.ts` — importado por toda a camada de repositório nas tasks seguintes e em fases futuras.

- [ ] **Step 1: Criar `src/lib/db/prismaClient.ts`**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

*(Padrão singleton necessário no Next.js em dev: evita esgotar conexões do Postgres a cada hot-reload do módulo.)*

- [ ] **Step 2: Criar `prisma/seed.ts`**

```ts
import { EventStatus, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const organizer = await prisma.organizer.upsert({
    where: { email: "demo@organizador.test" },
    update: {},
    create: {
      name: "Organizador Demo",
      email: "demo@organizador.test",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@organizador.test" },
    update: {},
    create: {
      organizerId: organizer.id,
      name: "Admin Demo",
      email: "admin@organizador.test",
      // hash de senha real será definido na fase de autenticação
      passwordHash: "placeholder-hash-set-in-auth-phase",
      role: Role.ORGANIZER_ADMIN,
    },
  });

  await prisma.event.upsert({
    where: { slug: "evento-demo" },
    update: {},
    create: {
      organizerId: organizer.id,
      name: "Evento Demo",
      slug: "evento-demo",
      location: "São Paulo, SP",
      startsAt: new Date("2026-12-01T20:00:00-03:00"),
      ticketPriceCents: 5000,
      capacity: 100,
      status: EventStatus.DRAFT,
    },
  });

  console.log("Seed concluído:", { organizerId: organizer.id });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 3: Rodar o seed**

Run: `npm run db:seed`
Expected: saída `Seed concluído: { organizerId: '...' }` sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/prismaClient.ts prisma/seed.ts
git commit -m "feat: add Prisma client singleton and seed script"
```

---

### Task 4: Vitest + repositório de Organizer (prova a infraestrutura de teste)

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/testDb.ts`
- Create: `src/lib/db/organizerRepository.ts`
- Test: `src/lib/db/organizerRepository.test.ts`

**Interfaces:**
- Consumes: `prisma` de `src/lib/db/prismaClient.ts` (Task 3).
- Produces: `createOrganizer(input)`, `findOrganizerById(organizerId)` em `organizerRepository.ts`; helper `resetDatabase()` em `tests/testDb.ts` — reutilizado por toda task de repositório seguinte (Task 5 e fases futuras).

- [ ] **Step 1: Criar `vitest.config.ts`**

```ts
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
```

- [ ] **Step 2: Criar `tests/testDb.ts`**

```ts
import { prisma } from "@/lib/db/prismaClient";

export { prisma as testPrisma };

export async function resetDatabase() {
  await prisma.checkInAttempt.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.order.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organizer.deleteMany();
}
```

- [ ] **Step 3: Escrever o teste que falha primeiro**

Create `src/lib/db/organizerRepository.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../../tests/testDb";
import { createOrganizer, findOrganizerById } from "./organizerRepository";

describe("organizerRepository", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates an organizer and finds it by id", async () => {
    const created = await createOrganizer({
      name: "Organizador Teste",
      email: "teste@organizador.dev",
    });

    const found = await findOrganizerById(created.id);

    expect(found).not.toBeNull();
    expect(found?.email).toBe("teste@organizador.dev");
  });

  it("returns null for an id that does not exist", async () => {
    const found = await findOrganizerById(crypto.randomUUID());

    expect(found).toBeNull();
  });
});
```

Also create an empty `src/lib/db/organizerRepository.ts` (no exports yet) so the import fails on the missing named exports rather than on a missing file.

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `npm test -- organizerRepository`
Expected: FAIL — `createOrganizer` e `findOrganizerById` não existem em `organizerRepository.ts`.

- [ ] **Step 5: Implementar `src/lib/db/organizerRepository.ts`**

```ts
import { prisma } from "./prismaClient";

export async function createOrganizer(input: {
  name: string;
  email: string;
  document?: string;
  logoUrl?: string;
}) {
  return prisma.organizer.create({ data: input });
}

export async function findOrganizerById(organizerId: string) {
  return prisma.organizer.findUnique({ where: { id: organizerId } });
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npm test -- organizerRepository`
Expected: PASS — 2 testes passando.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts tests/testDb.ts src/lib/db/organizerRepository.ts src/lib/db/organizerRepository.test.ts
git commit -m "test: add organizerRepository with test database wiring"
```

---

### Task 5: Repositório de Event com isolamento multi-tenant (garantia crítica)

**Files:**
- Create: `src/lib/db/eventRepository.ts`
- Test: `src/lib/db/eventRepository.test.ts`

**Interfaces:**
- Consumes: `prisma` de `src/lib/db/prismaClient.ts` (Task 3); `resetDatabase`, `testPrisma` de `tests/testDb.ts` (Task 4).
- Produces: `createEvent(organizerId, input)`, `listEventsByOrganizer(organizerId)`, `findEventForOrganizer(organizerId, eventId)` — este último é o padrão que toda busca tenant-scoped em fases futuras (Order, Ticket) deve seguir: sempre exigir `organizerId` **e** o id do recurso juntos, nunca buscar por id isolado.

- [ ] **Step 1: Escrever os testes que falham primeiro**

Create `src/lib/db/eventRepository.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../../tests/testDb";
import {
  createEvent,
  findEventForOrganizer,
  listEventsByOrganizer,
} from "./eventRepository";

describe("eventRepository", () => {
  let organizerAId: string;
  let organizerBId: string;

  beforeEach(async () => {
    await resetDatabase();
    const organizerA = await testPrisma.organizer.create({
      data: { name: "Organizador A", email: "a@organizador.dev" },
    });
    const organizerB = await testPrisma.organizer.create({
      data: { name: "Organizador B", email: "b@organizador.dev" },
    });
    organizerAId = organizerA.id;
    organizerBId = organizerB.id;
  });

  it("creates an event scoped to the organizer", async () => {
    const event = await createEvent(organizerAId, {
      name: "Show da Banda X",
      slug: "show-da-banda-x",
      location: "Curitiba, PR",
      startsAt: new Date("2026-11-01T21:00:00-03:00"),
      ticketPriceCents: 8000,
      capacity: 200,
    });

    expect(event.organizerId).toBe(organizerAId);
  });

  it("does not return another organizer's event", async () => {
    const event = await createEvent(organizerAId, {
      name: "Show da Banda X",
      slug: "show-da-banda-x-2",
      location: "Curitiba, PR",
      startsAt: new Date("2026-11-01T21:00:00-03:00"),
      ticketPriceCents: 8000,
      capacity: 200,
    });

    const foundByOwner = await findEventForOrganizer(organizerAId, event.id);
    const foundByOther = await findEventForOrganizer(organizerBId, event.id);

    expect(foundByOwner?.id).toBe(event.id);
    expect(foundByOther).toBeNull();
  });

  it("lists only events belonging to the given organizer", async () => {
    await createEvent(organizerAId, {
      name: "Evento A1",
      slug: "evento-a1",
      location: "São Paulo, SP",
      startsAt: new Date("2026-10-01T20:00:00-03:00"),
      ticketPriceCents: 3000,
      capacity: 50,
    });
    await createEvent(organizerBId, {
      name: "Evento B1",
      slug: "evento-b1",
      location: "Rio de Janeiro, RJ",
      startsAt: new Date("2026-10-05T20:00:00-03:00"),
      ticketPriceCents: 4000,
      capacity: 80,
    });

    const eventsForA = await listEventsByOrganizer(organizerAId);

    expect(eventsForA).toHaveLength(1);
    expect(eventsForA[0].slug).toBe("evento-a1");
  });
});
```

Also create an empty `src/lib/db/eventRepository.ts` (no exports yet).

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- eventRepository`
Expected: FAIL — `createEvent`, `findEventForOrganizer` e `listEventsByOrganizer` não existem.

- [ ] **Step 3: Implementar `src/lib/db/eventRepository.ts`**

```ts
import { prisma } from "./prismaClient";

type CreateEventInput = {
  name: string;
  slug: string;
  location: string;
  startsAt: Date;
  ticketPriceCents: number;
  capacity: number;
  description?: string;
  coverImageUrl?: string;
};

export async function createEvent(
  organizerId: string,
  input: CreateEventInput,
) {
  return prisma.event.create({
    data: { organizerId, ...input },
  });
}

export async function listEventsByOrganizer(organizerId: string) {
  return prisma.event.findMany({
    where: { organizerId },
    orderBy: { startsAt: "asc" },
  });
}

export async function findEventForOrganizer(
  organizerId: string,
  eventId: string,
) {
  return prisma.event.findFirst({
    where: { id: eventId, organizerId },
  });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- eventRepository`
Expected: PASS — 3 testes passando.

- [ ] **Step 5: Rodar a suíte completa de testes**

Run: `npm test`
Expected: PASS — todos os testes de `organizerRepository` e `eventRepository` passando (5 testes no total).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/eventRepository.ts src/lib/db/eventRepository.test.ts
git commit -m "feat: add tenant-scoped eventRepository with isolation tests"
```

---

## Fim da Fase 1

Ao concluir: `npm run dev` sobe a home; `npm run build` compila sem erros; `npm test` prova que um organizador nunca enxerga evento de outro. As próximas fases (cada uma como um plano separado) serão: **Fase 2 — Autenticação (Auth.js + RBAC)**, **Fase 3 — CRUD de eventos (painel do organizador)**, **Fase 4 — Checkout + webhook Mercado Pago + geração/envio de QR**, **Fase 5 — Scanner de portaria + validação atômica**, **Fase 6 — Tema visual (dark mode com contraste para a logo)**.
