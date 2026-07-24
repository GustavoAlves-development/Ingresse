# Página Pública do Evento — Capa, Atrações e Confirmados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O organizador consegue subir uma capa pro evento, cadastrar atrações (nome + foto) e definir um número de "pessoas confirmadas"; a página pública (`/e/[slug]`) exibe tudo isso de forma convidativa — capa em destaque, selo de confirmados, fileira de atrações — em vez do card genérico atual.

**Architecture:** Upload de imagem via Vercel Blob, direto do navegador (sem passar pelo servidor Next.js) — um componente client (`ImageUpload`) chama `upload()` do `@vercel/blob/client`, autorizado por uma rota própria (`POST /api/upload`) que exige sessão autenticada antes de emitir o token. A URL resultante é escrita num campo oculto e viaja pelos Server Actions já existentes (criar/editar evento, adicionar atração) — sem uma segunda etapa de submissão. Atrações são uma tabela nova (`Attraction`) com `organizerId` denormalizado de `Event`, seguindo o mesmo padrão de tenant-scoping já usado em `Order`/`Ticket`.

**Tech Stack:** `@vercel/blob` (upload/hospedagem de imagem).

## Global Constraints

- Nomenclatura obrigatória: camelCase. (spec original, seção 1)
- Padrão canônico de tenant-scoping: toda busca/escrita feita a partir de uma sessão de usuário logado exige `organizerId` **e** o id do recurso juntos na mesma query, nunca por id isolado. `Attraction.organizerId` é denormalizado de `Event` exatamente pelo mesmo motivo que `Order.organizerId`/`Ticket.organizerId` — evita join para filtrar por tenant.
- `POST /api/upload` exige sessão autenticada antes de emitir qualquer token de upload — sem isso, um visitante anônimo poderia consumir a cota de armazenamento do projeto. (spec desta feature, seção 7)
- Ao atualizar um evento, um campo opcional ausente deve ser gravado como `null` (limpa o campo), nunca como `undefined` (que o Prisma silenciosamente ignora em `updateMany`) — mesma lição já documentada em `updateEvent`/`description` (Fase 3). Vale também para `confirmedAttendees`: use `??`, nunca `||`, para não converter `0` (um valor válido) em `null`.
- `confirmedAttendees` é um número **manual**, não a contagem real de ingressos vendidos — sem validação contra `capacity`. (spec desta feature, seção 2)

---

### Task 1: Schema — `Event.confirmedAttendees` + modelo `Attraction` + migração

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_event_extras_and_attractions/` (gerado pelo Prisma)
- Modify: `tests/testDb.ts`

**Interfaces:**
- Produces: coluna `Event.confirmedAttendees` (`Int?`), modelo `Attraction` (`id`, `eventId`, `organizerId`, `name`, `photoUrl?`, `createdAt`) — consumido por `attractionRepository` (Task 4) e `eventRepository` (Task 3).

- [ ] **Step 1: Editar `prisma/schema.prisma`**

No `model Event`, adicione o campo `confirmedAttendees` logo depois de `coverImageUrl`, e a relação `attractions` logo depois de `tickets`:

```prisma
model Event {
  id                 String      @id @default(uuid())
  organizerId        String
  name               String
  slug               String      @unique
  description        String?
  location           String
  startsAt           DateTime
  ticketPriceCents   Int
  capacity           Int
  status             EventStatus @default(DRAFT)
  coverImageUrl      String?
  confirmedAttendees Int?
  createdAt          DateTime    @default(now())

  organizer   Organizer    @relation(fields: [organizerId], references: [id])
  orders      Order[]
  tickets     Ticket[]
  attractions Attraction[]

  @@index([organizerId])
}
```

Adicione o novo modelo no final do arquivo (depois de `CheckInAttempt`):

```prisma
model Attraction {
  id          String   @id @default(uuid())
  eventId     String
  organizerId String // denormalizado de Event, evita join para filtrar por tenant (mesmo padrão de Order/Ticket)
  name        String
  photoUrl    String?
  createdAt   DateTime @default(now())

  event Event @relation(fields: [eventId], references: [id])

  @@index([eventId])
  @@index([organizerId])
}
```

- [ ] **Step 2: Rodar a migração no banco de desenvolvimento**

Run: `npx prisma migrate dev --name add_event_extras_and_attractions`
Expected: saída terminando em `Your database is now in sync with your schema.`, cria `prisma/migrations/<timestamp>_add_event_extras_and_attractions/migration.sql`, regenera o Prisma Client automaticamente.

- [ ] **Step 3: Aplicar a mesma migração no banco de teste**

O banco de teste (`.env.test`) não é tocado por `migrate dev` (que usa o `DATABASE_URL` de `.env`) — precisa aplicar manualmente, senão os testes das próximas tasks falham com "table does not exist".

Run: `DATABASE_URL=$(grep DATABASE_URL .env.test | cut -d '=' -f2- | tr -d '"') npx prisma migrate deploy`
Expected: `All migrations have been successfully applied.`

- [ ] **Step 4: Atualizar `tests/testDb.ts` para limpar `Attraction` no reset**

`Attraction` referencia `Event` — precisa ser apagada antes de `Event` no `resetDatabase()`, senão a constraint de chave estrangeira falha.

```ts
import { prisma } from "@/lib/db/prismaClient";

export { prisma as testPrisma };

export async function resetDatabase() {
  await prisma.checkInAttempt.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.order.deleteMany();
  await prisma.attraction.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organizer.deleteMany();
}
```

- [ ] **Step 5: Verificar que os tipos do Prisma Client regeneraram corretamente**

Run: `npx tsc --noEmit`
Expected: sem erros (confirma que `PrismaClient` já conhece `Attraction` e `Event.confirmedAttendees`).

- [ ] **Step 6: Rodar a suíte completa e confirmar que nada quebrou**

Run: `npm test`
Expected: PASS — todos os testes existentes continuam passando (prova que a migração foi aplicada corretamente no banco de teste).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/testDb.ts
git commit -m "feat: add Event.confirmedAttendees and Attraction model"
```

---

### Task 2: Validação Zod — `eventSchema` (capa + confirmados) e novo `attractionSchema`

**Files:**
- Modify: `src/lib/events/eventSchema.ts`
- Modify: `src/lib/events/eventSchema.test.ts`
- Create: `src/lib/events/attractionSchema.ts`
- Test: `src/lib/events/attractionSchema.test.ts`

**Interfaces:**
- Produces: `createEventSchema`/`updateEventSchema` (Zod, campos `coverImageUrl?: string`, `confirmedAttendees?: number` adicionados); `addAttractionSchema` (Zod, `{ name: string; photoUrl?: string }`) — ambos consumidos pelas Server Actions das Tasks 7/8.

- [ ] **Step 1: Escrever os testes que falham primeiro**

Modifique `src/lib/events/eventSchema.test.ts`, adicionando estes casos ao `describe("createEventSchema", ...)` já existente (depois do teste `"rejects non-integer capacity"`, antes do `});` de fechamento):

```ts
  it("accepts an optional coverImageUrl", () => {
    const result = createEventSchema.safeParse({
      ...validInput,
      coverImageUrl: "https://example.com/capa.jpg",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.coverImageUrl).toBe("https://example.com/capa.jpg");
    }
  });

  it("treats an empty coverImageUrl as absent instead of an invalid URL", () => {
    const result = createEventSchema.safeParse({
      ...validInput,
      coverImageUrl: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.coverImageUrl).toBeUndefined();
    }
  });

  it("rejects a coverImageUrl that is not a valid URL", () => {
    const result = createEventSchema.safeParse({
      ...validInput,
      coverImageUrl: "not-a-url",
    });

    expect(result.success).toBe(false);
  });

  it("accepts an optional confirmedAttendees", () => {
    const result = createEventSchema.safeParse({
      ...validInput,
      confirmedAttendees: "42",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confirmedAttendees).toBe(42);
    }
  });

  it("treats an empty confirmedAttendees as absent instead of zero", () => {
    const result = createEventSchema.safeParse({
      ...validInput,
      confirmedAttendees: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confirmedAttendees).toBeUndefined();
    }
  });

  it("rejects a negative confirmedAttendees", () => {
    const result = createEventSchema.safeParse({
      ...validInput,
      confirmedAttendees: "-1",
    });

    expect(result.success).toBe(false);
  });
```

Create `src/lib/events/attractionSchema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addAttractionSchema } from "./attractionSchema";

describe("addAttractionSchema", () => {
  it("accepts a name with a photo URL", () => {
    const result = addAttractionSchema.safeParse({
      name: "DJ Teste",
      photoUrl: "https://example.com/dj.jpg",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("DJ Teste");
      expect(result.data.photoUrl).toBe("https://example.com/dj.jpg");
    }
  });

  it("accepts a name without a photo", () => {
    const result = addAttractionSchema.safeParse({
      name: "DJ Sem Foto",
      photoUrl: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.photoUrl).toBeUndefined();
    }
  });

  it("rejects a missing name", () => {
    const result = addAttractionSchema.safeParse({ name: "", photoUrl: "" });

    expect(result.success).toBe(false);
  });

  it("rejects a name that is only whitespace", () => {
    const result = addAttractionSchema.safeParse({
      name: "   ",
      photoUrl: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a photoUrl that is not a valid URL", () => {
    const result = addAttractionSchema.safeParse({
      name: "DJ Teste",
      photoUrl: "not-a-url",
    });

    expect(result.success).toBe(false);
  });
});
```

Also create an empty `src/lib/events/attractionSchema.ts` (no exports yet).

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- eventSchema attractionSchema`
Expected: FAIL — `createEventSchema` não aceita `coverImageUrl`/`confirmedAttendees` ainda (os testes novos falham), e `addAttractionSchema` não existe.

- [ ] **Step 3: Implementar `src/lib/events/eventSchema.ts`**

```ts
import { z } from "zod";
import { parseAsSaoPauloTime } from "./eventDateTime";

const emptyStringToUndefined = (value: unknown) =>
  value === "" ? undefined : value;

const eventFieldsSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  location: z.string().trim().min(1, "Local é obrigatório"),
  startsAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Data/hora inválida")
    .transform((value) => parseAsSaoPauloTime(value)),
  ticketPriceReais: z.coerce
    .number()
    .positive("Preço deve ser maior que zero"),
  capacity: z.coerce.number().int().positive("Capacidade deve ser maior que zero"),
  coverImageUrl: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().url("URL de imagem inválida").optional(),
  ),
  confirmedAttendees: z.preprocess(
    emptyStringToUndefined,
    z.coerce
      .number()
      .int()
      .nonnegative("Não pode ser negativo")
      .optional(),
  ),
});

export const createEventSchema = eventFieldsSchema;

export const updateEventSchema = eventFieldsSchema.extend({
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]),
});
```

- [ ] **Step 4: Implementar `src/lib/events/attractionSchema.ts`**

```ts
import { z } from "zod";

const emptyStringToUndefined = (value: unknown) =>
  value === "" ? undefined : value;

export const addAttractionSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  photoUrl: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().url("URL de imagem inválida").optional(),
  ),
});
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npm test -- eventSchema attractionSchema`
Expected: PASS.

- [ ] **Step 6: Rodar a suíte completa**

Run: `npm test`
Expected: PASS — nenhuma regressão nas telas que já usam `createEventSchema`/`updateEventSchema` (os novos campos são opcionais, formulários existentes continuam válidos sem eles).

- [ ] **Step 7: Commit**

```bash
git add src/lib/events/eventSchema.ts src/lib/events/eventSchema.test.ts src/lib/events/attractionSchema.ts src/lib/events/attractionSchema.test.ts
git commit -m "feat: validate event cover/confirmed-attendees and attraction input"
```

---

### Task 3: `eventRepository` — incluir atrações, aceitar capa/confirmados na atualização

**Files:**
- Modify: `src/lib/db/eventRepository.ts`
- Modify: `src/lib/db/eventRepository.test.ts`

**Interfaces:**
- Consumes: `Attraction` do Prisma Client (Task 1).
- Produces: `findEventForOrganizer`/`findEventBySlug` agora retornam `.attractions: Attraction[]` (ordenadas por `createdAt` asc); `CreateEventInput`/`UpdateEventInput` ganham `coverImageUrl`/`confirmedAttendees`.

- [ ] **Step 1: Escrever os testes que falham primeiro**

Em `src/lib/db/eventRepository.test.ts`, adicione este teste no corpo principal do `describe("eventRepository", ...)`, logo depois do teste `"returns null for an eventId that does not exist"` (antes do `describe("updateEvent", ...)`):

```ts
  it("includes attractions ordered by creation time", async () => {
    const event = await createEvent(organizerAId, {
      name: "Show com Atrações",
      slug: "show-com-atracoes",
      location: "São Paulo, SP",
      startsAt: new Date("2026-11-01T21:00:00-03:00"),
      ticketPriceCents: 5000,
      capacity: 100,
    });
    await testPrisma.attraction.create({
      data: { eventId: event.id, organizerId: organizerAId, name: "DJ Primeiro" },
    });
    await testPrisma.attraction.create({
      data: { eventId: event.id, organizerId: organizerAId, name: "DJ Segundo" },
    });

    const found = await findEventForOrganizer(organizerAId, event.id);

    expect(found?.attractions).toHaveLength(2);
    expect(found?.attractions[0].name).toBe("DJ Primeiro");
    expect(found?.attractions[1].name).toBe("DJ Segundo");
  });
```

Dentro do `describe("updateEvent", ...)`, adicione estes dois testes logo depois de `"clears the description when null is passed"` (antes do `});` que fecha o describe):

```ts
    it("persists coverImageUrl and confirmedAttendees", async () => {
      const event = await createEvent(organizerAId, {
        name: "Evento Teste",
        slug: "evento-cover-confirmados",
        location: "São Paulo, SP",
        startsAt: new Date("2026-10-01T20:00:00-03:00"),
        ticketPriceCents: 3000,
        capacity: 50,
      });

      await updateEvent(organizerAId, event.id, {
        name: event.name,
        location: event.location,
        startsAt: event.startsAt,
        ticketPriceCents: event.ticketPriceCents,
        capacity: event.capacity,
        status: "PUBLISHED",
        coverImageUrl: "https://example.com/capa.jpg",
        confirmedAttendees: 42,
      });

      const fetched = await findEventForOrganizer(organizerAId, event.id);
      expect(fetched?.coverImageUrl).toBe("https://example.com/capa.jpg");
      expect(fetched?.confirmedAttendees).toBe(42);
    });

    it("clears coverImageUrl and confirmedAttendees when null is passed", async () => {
      const event = await createEvent(organizerAId, {
        name: "Evento Teste",
        slug: "evento-limpa-cover-confirmados",
        location: "São Paulo, SP",
        startsAt: new Date("2026-10-01T20:00:00-03:00"),
        ticketPriceCents: 3000,
        capacity: 50,
        coverImageUrl: "https://example.com/capa.jpg",
        confirmedAttendees: 10,
      });

      await updateEvent(organizerAId, event.id, {
        name: event.name,
        location: event.location,
        startsAt: event.startsAt,
        ticketPriceCents: event.ticketPriceCents,
        capacity: event.capacity,
        status: "PUBLISHED",
        coverImageUrl: null,
        confirmedAttendees: null,
      });

      const fetched = await findEventForOrganizer(organizerAId, event.id);
      expect(fetched?.coverImageUrl).toBeNull();
      expect(fetched?.confirmedAttendees).toBeNull();
    });
```

No `describe("findEventById and findEventBySlug", ...)`, adicione este teste depois de `"findEventBySlug returns the event by its unique slug"`:

```ts
    it("findEventBySlug includes attractions ordered by creation time", async () => {
      const event = await createEvent(organizerAId, {
        name: "Evento com Atrações",
        slug: "evento-com-atracoes-slug",
        location: "São Paulo, SP",
        startsAt: new Date("2026-11-01T20:00:00-03:00"),
        ticketPriceCents: 5000,
        capacity: 100,
      });
      await testPrisma.attraction.create({
        data: { eventId: event.id, organizerId: organizerAId, name: "DJ Teste" },
      });

      const found = await findEventBySlug("evento-com-atracoes-slug");

      expect(found?.attractions).toHaveLength(1);
      expect(found?.attractions[0].name).toBe("DJ Teste");
    });
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- eventRepository`
Expected: FAIL — `found?.attractions` é `undefined` (o `include` ainda não existe), e `coverImageUrl`/`confirmedAttendees` não são aceitos por `UpdateEventInput`.

- [ ] **Step 3: Implementar `src/lib/db/eventRepository.ts`**

```ts
import type { EventStatus } from "@prisma/client";
import { prisma } from "./prismaClient";

export type CreateEventInput = {
  name: string;
  slug: string;
  location: string;
  startsAt: Date;
  ticketPriceCents: number;
  capacity: number;
  description?: string;
  coverImageUrl?: string;
  confirmedAttendees?: number;
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

// Padrão OBRIGATÓRIO para toda busca tenant-scoped: sempre exigir
// organizerId E o id do recurso juntos via findFirst, nunca buscar por id
// isolado — evita vazamento de dado entre organizadores.
export async function findEventForOrganizer(
  organizerId: string,
  eventId: string,
) {
  return prisma.event.findFirst({
    where: { id: eventId, organizerId },
    include: { attractions: { orderBy: { createdAt: "asc" } } },
  });
}

export type UpdateEventInput = {
  name: string;
  description?: string | null;
  location: string;
  startsAt: Date;
  ticketPriceCents: number;
  capacity: number;
  status: EventStatus;
  coverImageUrl?: string | null;
  confirmedAttendees?: number | null;
};

export async function updateEvent(
  organizerId: string,
  eventId: string,
  input: UpdateEventInput,
) {
  const result = await prisma.event.updateMany({
    where: { id: eventId, organizerId },
    data: input,
  });

  return result.count === 1;
}

// Lookup por id sem escopo de organizador — uso restrito a processos de
// sistema (webhook, checkout) que já obtiveram o eventId de um registro
// nosso confiável (nunca de input de sessão de usuário tentando acessar
// dado de outro tenant). Não use isso a partir de uma rota que recebe
// eventId vindo de uma sessão autenticada — use findEventForOrganizer.
export async function findEventById(eventId: string) {
  return prisma.event.findUnique({ where: { id: eventId } });
}

// Lookup público por slug — qualquer visitante pode ver um evento
// publicado pelo slug (é o propósito da página pública de vendas).
export async function findEventBySlug(slug: string) {
  return prisma.event.findUnique({
    where: { slug },
    include: { attractions: { orderBy: { createdAt: "asc" } } },
  });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- eventRepository`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/eventRepository.ts src/lib/db/eventRepository.test.ts
git commit -m "feat: include attractions and cover/confirmed fields in eventRepository"
```

---

### Task 4: `attractionRepository` — criar e remover atração com isolamento de tenant

**Files:**
- Create: `src/lib/db/attractionRepository.ts`
- Test: `src/lib/db/attractionRepository.test.ts`

**Interfaces:**
- Produces: `createAttraction(eventId: string, organizerId: string, input: { name: string; photoUrl?: string }): Promise<Attraction>`; `deleteAttractionForOrganizer(organizerId: string, attractionId: string): Promise<boolean>` — ambos consumidos pelas Server Actions da Task 8.

- [ ] **Step 1: Escrever os testes que falham primeiro**

Create `src/lib/db/attractionRepository.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../../tests/testDb";
import {
  createAttraction,
  deleteAttractionForOrganizer,
} from "./attractionRepository";

describe("attractionRepository", () => {
  let organizerId: string;
  let eventId: string;

  beforeEach(async () => {
    await resetDatabase();
    const organizer = await testPrisma.organizer.create({
      data: { name: "Organizador Teste", email: "org@teste.dev" },
    });
    organizerId = organizer.id;
    const event = await testPrisma.event.create({
      data: {
        organizerId,
        name: "Show de Teste",
        slug: "show-attraction-teste",
        location: "São Paulo, SP",
        startsAt: new Date("2026-12-01T23:00:00.000Z"),
        ticketPriceCents: 5000,
        capacity: 100,
        status: "PUBLISHED",
      },
    });
    eventId = event.id;
  });

  describe("createAttraction", () => {
    it("creates an attraction with organizerId denormalized from the event", async () => {
      const attraction = await createAttraction(eventId, organizerId, {
        name: "DJ Teste",
        photoUrl: "https://example.com/dj.jpg",
      });

      expect(attraction.name).toBe("DJ Teste");
      expect(attraction.eventId).toBe(eventId);
      expect(attraction.organizerId).toBe(organizerId);
      expect(attraction.photoUrl).toBe("https://example.com/dj.jpg");
    });

    it("creates an attraction without a photo", async () => {
      const attraction = await createAttraction(eventId, organizerId, {
        name: "DJ Sem Foto",
      });

      expect(attraction.photoUrl).toBeNull();
    });
  });

  describe("deleteAttractionForOrganizer", () => {
    it("deletes an attraction that belongs to the organizer", async () => {
      const attraction = await createAttraction(eventId, organizerId, {
        name: "DJ Teste",
      });

      const deleted = await deleteAttractionForOrganizer(
        organizerId,
        attraction.id,
      );

      expect(deleted).toBe(true);
      const found = await testPrisma.attraction.findUnique({
        where: { id: attraction.id },
      });
      expect(found).toBeNull();
    });

    it("does not delete an attraction that belongs to another organizer", async () => {
      const otherOrganizer = await testPrisma.organizer.create({
        data: { name: "Outro Organizador", email: "outro@teste.dev" },
      });
      const attraction = await createAttraction(eventId, organizerId, {
        name: "DJ Teste",
      });

      const deleted = await deleteAttractionForOrganizer(
        otherOrganizer.id,
        attraction.id,
      );

      expect(deleted).toBe(false);
      const found = await testPrisma.attraction.findUnique({
        where: { id: attraction.id },
      });
      expect(found).not.toBeNull();
    });

    it("returns false for a nonexistent attractionId", async () => {
      const deleted = await deleteAttractionForOrganizer(
        organizerId,
        crypto.randomUUID(),
      );

      expect(deleted).toBe(false);
    });
  });
});
```

Also create an empty `src/lib/db/attractionRepository.ts` (no exports yet).

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- attractionRepository`
Expected: FAIL — `createAttraction`/`deleteAttractionForOrganizer` não existem.

- [ ] **Step 3: Implementar `src/lib/db/attractionRepository.ts`**

```ts
import { prisma } from "./prismaClient";

type CreateAttractionInput = {
  name: string;
  photoUrl?: string;
};

export async function createAttraction(
  eventId: string,
  organizerId: string,
  input: CreateAttractionInput,
) {
  return prisma.attraction.create({
    data: { eventId, organizerId, ...input },
  });
}

// Padrão canônico de tenant-scoping (mesmo de updateEvent): organizerId e o
// id do recurso juntos na mesma query, nunca por id isolado. organizerId
// está denormalizado em Attraction, então não precisa de join até Event.
export async function deleteAttractionForOrganizer(
  organizerId: string,
  attractionId: string,
): Promise<boolean> {
  const result = await prisma.attraction.deleteMany({
    where: { id: attractionId, organizerId },
  });

  return result.count === 1;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- attractionRepository`
Expected: PASS — 5 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/attractionRepository.ts src/lib/db/attractionRepository.test.ts
git commit -m "feat: add attractionRepository with tenant-scoped create/delete"
```

---

### Task 5: `POST /api/upload` — autorização de upload para o Vercel Blob

**Files:**
- Create: `src/app/api/upload/route.ts`
- Test: `src/app/api/upload/route.test.ts`
- Modify: `.env.example`
- Modify: `package.json` (dependência `@vercel/blob`)

**Interfaces:**
- Consumes: `auth()` de `src/auth.ts`.
- Produces: rota `POST /api/upload` compatível com o contrato `handleUploadUrl` do `upload()` client-side do `@vercel/blob/client` (Task 6).

- [ ] **Step 1: Instalar dependência**

Run: `npm install @vercel/blob`
Expected: instala sem erros.

- [ ] **Step 2: Escrever os testes que falham primeiro**

Create `src/app/api/upload/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: authMock,
}));

const handleUploadMock = vi.fn(
  async ({
    onBeforeGenerateToken,
  }: {
    onBeforeGenerateToken: (
      pathname: string,
    ) => Promise<Record<string, unknown>>;
  }) => {
    const tokenOptions = await onBeforeGenerateToken("test.png");
    return {
      type: "blob.generate-client-token",
      clientToken: "fake-token",
      ...tokenOptions,
    };
  },
);
vi.mock("@vercel/blob/client", () => ({
  handleUpload: handleUploadMock,
}));

const { POST } = await import("./route");

function buildRequest() {
  return new Request("http://localhost/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "blob.generate-client-token" }),
  });
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    authMock.mockReset();
    handleUploadMock.mockClear();
  });

  it("returns 400 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it("authorizes the upload with content-type and size restrictions when there is a session", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", organizerId: "org-1", role: "ORGANIZER_ADMIN" },
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.allowedContentTypes).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    expect(body.maximumSizeInBytes).toBe(5 * 1024 * 1024);
  });
});
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `npm test -- src/app/api/upload`
Expected: FAIL — o módulo `./route` não existe.

- [ ] **Step 4: Implementar `src/app/api/upload/route.ts`**

```ts
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        if (!session?.user?.organizerId) {
          throw new Error("unauthorized");
        }

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: 5 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // Sem ação: a URL retornada pelo upload() no cliente já é escrita
        // diretamente no formulário (evento/atração) que a envia — não há
        // nada a persistir aqui. onUploadCompleted também não roda em
        // localhost (precisa de uma callback URL pública), mas isso é OK:
        // não dependemos dele para nada.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npm test -- src/app/api/upload`
Expected: PASS.

- [ ] **Step 6: Documentar a variável de ambiente nova**

Adicione ao final de `.env.example`:

```
# Vercel Blob — token de leitura/escrita para upload de imagens
BLOB_READ_WRITE_TOKEN="replace-with-a-real-vercel-blob-token"
```

- [ ] **Step 7: Rodar a suíte completa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/app/api/upload/route.ts src/app/api/upload/route.test.ts .env.example
git commit -m "feat: add authenticated Vercel Blob upload authorization route"
```

---

### Task 6: Componente `ImageUpload` (client)

**Files:**
- Create: `src/components/admin/ImageUpload.tsx`

**Interfaces:**
- Consumes: `POST /api/upload` (Task 5) via `upload()` do `@vercel/blob/client`.
- Produces: `<ImageUpload name={string} defaultValue={string | null} />` — um `<input type="hidden" name={name}>` com a URL da imagem, para usar dentro de um `Field` já existente (`<FieldLabel>` fica por conta de quem usa o componente, mesmo padrão de `Input`/`Textarea`).

**Nota sobre testes:** sem teste automatizado, mesmo padrão do `QrScanner` (Fase 5) — depende de upload de arquivo real via `fetch`, que não existe no ambiente de teste (`environment: "node"`). Verificação é manual, no navegador (Task 7).

- [ ] **Step 1: Implementar `src/components/admin/ImageUpload.tsx`**

```tsx
"use client";

import { upload } from "@vercel/blob/client";
import { useState } from "react";

export function ImageUpload({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string | null;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [status, setStatus] = useState<"idle" | "uploading" | "error">(
    "idle",
  );

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setStatus("uploading");
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      setUrl(blob.url);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={url} />
      {url && (
        <img
          src={url}
          alt=""
          className="h-32 w-full rounded-lg object-cover"
        />
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={status === "uploading"}
        className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-input file:bg-transparent file:px-2.5 file:py-1 file:text-sm file:font-medium file:text-foreground"
      />
      {status === "uploading" && (
        <p className="text-sm text-muted-foreground">Enviando...</p>
      )}
      {status === "error" && (
        <p className="text-sm text-destructive">
          Falha no upload. Tente novamente.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rodar a suíte completa e confirmar que nada quebrou**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ImageUpload.tsx
git commit -m "feat: add ImageUpload component for direct-to-Blob uploads"
```

---

### Task 7: Página "Novo evento" — capa e confirmados

**Files:**
- Modify: `src/app/admin/events/new/page.tsx`

**Interfaces:**
- Consumes: `ImageUpload` (Task 6), `createEventSchema` (Task 2, já com `coverImageUrl`/`confirmedAttendees`), `createEvent` (Task 3, `CreateEventInput` já aceita os dois campos).

**Nota sobre testes:** sem teste automatizado próprio, mesmo padrão das demais páginas de UI deste projeto. Verificação é manual, no navegador (Step 3).

- [ ] **Step 1: Substituir `src/app/admin/events/new/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createEvent } from "@/lib/db/eventRepository";
import { createEventSchema } from "@/lib/events/eventSchema";
import { slugify } from "@/lib/events/slugify";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/admin/ImageUpload";

async function createEventAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  const parsed = createEventSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    location: formData.get("location"),
    startsAt: formData.get("startsAt"),
    ticketPriceReais: formData.get("ticketPriceReais"),
    capacity: formData.get("capacity"),
    coverImageUrl: formData.get("coverImageUrl"),
    confirmedAttendees: formData.get("confirmedAttendees"),
  });

  if (!parsed.success) {
    redirect("/admin/events/new?error=1");
  }

  const {
    name,
    description,
    location,
    startsAt,
    ticketPriceReais,
    capacity,
    coverImageUrl,
    confirmedAttendees,
  } = parsed.data;

  await createEvent(session.user.organizerId, {
    name,
    slug: slugify(name),
    description: description || undefined,
    location,
    startsAt,
    ticketPriceCents: Math.round(ticketPriceReais * 100),
    capacity,
    coverImageUrl,
    confirmedAttendees,
  });

  redirect("/admin/events");
}

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-md p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Novo evento</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Verifique os campos preenchidos.
              </AlertDescription>
            </Alert>
          )}
          <form action={createEventAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Nome do evento</FieldLabel>
                <Input id="name" name="name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="description">
                  Descrição (opcional)
                </FieldLabel>
                <Textarea id="description" name="description" />
              </Field>
              <Field>
                <FieldLabel htmlFor="coverImageUrl">
                  Capa do evento (opcional)
                </FieldLabel>
                <ImageUpload name="coverImageUrl" />
              </Field>
              <Field>
                <FieldLabel htmlFor="location">Local</FieldLabel>
                <Input id="location" name="location" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="startsAt">Data e hora</FieldLabel>
                <Input
                  id="startsAt"
                  name="startsAt"
                  type="datetime-local"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ticketPriceReais">
                  Preço do ingresso (R$)
                </FieldLabel>
                <Input
                  id="ticketPriceReais"
                  name="ticketPriceReais"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className="font-mono"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="capacity">Capacidade</FieldLabel>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  step="1"
                  min="1"
                  required
                  className="font-mono"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirmedAttendees">
                  Pessoas confirmadas (opcional)
                </FieldLabel>
                <Input
                  id="confirmedAttendees"
                  name="confirmedAttendees"
                  type="number"
                  step="1"
                  min="0"
                  className="font-mono"
                />
              </Field>
              <Button type="submit">Criar evento</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Rodar a suíte completa e `tsc`**

Run: `npm test && npx tsc --noEmit`
Expected: PASS em ambos.

- [ ] **Step 3: Verificação manual no navegador**

Run: `npm run dev`, logue como `ORGANIZER_ADMIN`, acesse `/admin/events/new`.
Expected: o formulário mostra "Capa do evento (opcional)" com um seletor de arquivo e "Pessoas confirmadas (opcional)". Sem `BLOB_READ_WRITE_TOKEN` configurado o upload falha (mostra "Falha no upload. Tente novamente.") — isso é esperado; confirme que o resto do formulário (todos os campos exceto a capa) continua funcionando e cria o evento normalmente mesmo sem subir uma imagem.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/events/new/page.tsx
git commit -m "feat: add cover image and confirmed-attendees fields to new-event form"
```

---

### Task 8: Página "Editar evento" — capa, confirmados e seção de Atrações

**Files:**
- Modify: `src/app/admin/events/[eventId]/edit/page.tsx`

**Interfaces:**
- Consumes: `ImageUpload` (Task 6), `addAttractionSchema` (Task 2), `createAttraction`/`deleteAttractionForOrganizer` (Task 4), `event.attractions` (Task 3).

**Nota sobre testes:** sem teste automatizado próprio, mesmo padrão das demais páginas de UI. Verificação é manual, no navegador (Step 3).

- [ ] **Step 1: Substituir `src/app/admin/events/[eventId]/edit/page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createAttraction,
  deleteAttractionForOrganizer,
} from "@/lib/db/attractionRepository";
import { findEventForOrganizer, updateEvent } from "@/lib/db/eventRepository";
import { toSaoPauloDatetimeLocalValue } from "@/lib/events/eventDateTime";
import { addAttractionSchema } from "@/lib/events/attractionSchema";
import { updateEventSchema } from "@/lib/events/eventSchema";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/admin/ImageUpload";

async function updateEventAction(eventId: string, formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  const parsed = updateEventSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    location: formData.get("location"),
    startsAt: formData.get("startsAt"),
    ticketPriceReais: formData.get("ticketPriceReais"),
    capacity: formData.get("capacity"),
    status: formData.get("status"),
    coverImageUrl: formData.get("coverImageUrl"),
    confirmedAttendees: formData.get("confirmedAttendees"),
  });

  if (!parsed.success) {
    redirect(`/admin/events/${eventId}/edit?error=1`);
  }

  const {
    name,
    description,
    location,
    startsAt,
    ticketPriceReais,
    capacity,
    status,
    coverImageUrl,
    confirmedAttendees,
  } = parsed.data;

  const updated = await updateEvent(session.user.organizerId, eventId, {
    name,
    description: description || null,
    location,
    startsAt,
    ticketPriceCents: Math.round(ticketPriceReais * 100),
    capacity,
    status,
    coverImageUrl: coverImageUrl ?? null,
    confirmedAttendees: confirmedAttendees ?? null,
  });

  if (!updated) {
    notFound();
  }

  redirect("/admin/events");
}

async function addAttractionAction(eventId: string, formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  const parsed = addAttractionSchema.safeParse({
    name: formData.get("name"),
    photoUrl: formData.get("photoUrl"),
  });

  if (!parsed.success) {
    redirect(`/admin/events/${eventId}/edit?error=attraction`);
  }

  const event = await findEventForOrganizer(session.user.organizerId, eventId);
  if (!event) {
    notFound();
  }

  await createAttraction(eventId, session.user.organizerId, parsed.data);

  redirect(`/admin/events/${eventId}/edit`);
}

async function removeAttractionAction(
  eventId: string,
  attractionId: string,
) {
  "use server";

  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  await deleteAttractionForOrganizer(session.user.organizerId, attractionId);

  redirect(`/admin/events/${eventId}/edit`);
}

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Rascunho" },
  { value: "PUBLISHED", label: "Publicado" },
  { value: "CLOSED", label: "Encerrado" },
];

const nativeSelectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  const { eventId } = await params;
  const { error } = await searchParams;

  const event = await findEventForOrganizer(session.user.organizerId, eventId);
  if (!event) {
    notFound();
  }

  const boundUpdateAction = updateEventAction.bind(null, eventId);
  const boundAddAttractionAction = addAttractionAction.bind(null, eventId);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Editar evento</CardTitle>
        </CardHeader>
        <CardContent>
          {error === "1" && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Verifique os campos preenchidos.
              </AlertDescription>
            </Alert>
          )}
          <form action={boundUpdateAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Nome do evento</FieldLabel>
                <Input id="name" name="name" defaultValue={event.name} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="description">
                  Descrição (opcional)
                </FieldLabel>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={event.description ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="coverImageUrl">
                  Capa do evento (opcional)
                </FieldLabel>
                <ImageUpload
                  name="coverImageUrl"
                  defaultValue={event.coverImageUrl}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="location">Local</FieldLabel>
                <Input
                  id="location"
                  name="location"
                  defaultValue={event.location}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="startsAt">Data e hora</FieldLabel>
                <Input
                  id="startsAt"
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={toSaoPauloDatetimeLocalValue(event.startsAt)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ticketPriceReais">
                  Preço do ingresso (R$)
                </FieldLabel>
                <Input
                  id="ticketPriceReais"
                  name="ticketPriceReais"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={(event.ticketPriceCents / 100).toFixed(2)}
                  required
                  className="font-mono"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="capacity">Capacidade</FieldLabel>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  step="1"
                  min="1"
                  defaultValue={event.capacity}
                  required
                  className="font-mono"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirmedAttendees">
                  Pessoas confirmadas (opcional)
                </FieldLabel>
                <Input
                  id="confirmedAttendees"
                  name="confirmedAttendees"
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={event.confirmedAttendees ?? ""}
                  className="font-mono"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="status">Status</FieldLabel>
                <select
                  id="status"
                  name="status"
                  defaultValue={event.status}
                  className={nativeSelectClassName}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Button type="submit">Salvar</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Atrações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error === "attraction" && (
            <Alert variant="destructive">
              <AlertDescription>
                Verifique o nome da atração.
              </AlertDescription>
            </Alert>
          )}
          {event.attractions.length > 0 && (
            <ul className="flex flex-col gap-3">
              {event.attractions.map((attraction) => (
                <li
                  key={attraction.id}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    {attraction.photoUrl ? (
                      <img
                        src={attraction.photoUrl}
                        alt=""
                        className="size-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                        {attraction.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="text-sm font-medium">
                      {attraction.name}
                    </span>
                  </div>
                  <form
                    action={removeAttractionAction.bind(
                      null,
                      eventId,
                      attraction.id,
                    )}
                  >
                    <Button type="submit" variant="outline" size="sm">
                      Remover
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form
            action={boundAddAttractionAction}
            className="flex flex-col gap-3 border-t border-border pt-4"
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="attractionName">Nome</FieldLabel>
                <Input id="attractionName" name="name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="attractionPhoto">
                  Foto (opcional)
                </FieldLabel>
                <ImageUpload name="photoUrl" />
              </Field>
              <Button type="submit" variant="outline">
                Adicionar atração
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Rodar a suíte completa e `tsc`**

Run: `npm test && npx tsc --noEmit`
Expected: PASS em ambos.

- [ ] **Step 3: Verificação manual no navegador**

Run: `npm run dev`, acesse `/admin/events/[eventId]/edit` de um evento existente.
Expected: os campos "Capa do evento" e "Pessoas confirmadas" aparecem preenchidos com os valores atuais (vazio se nunca foram definidos). A seção "Atrações" lista as já cadastradas (vazio na primeira vez) e tem um miniformulário "Nome" + "Foto (opcional)" + "Adicionar atração" — submeter cria uma atração e recarrega a página já mostrando ela na lista, com o botão "Remover" funcionando.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/events/[eventId]/edit/page.tsx"
git commit -m "feat: add cover, confirmed-attendees, and attractions management to edit-event form"
```

---

### Task 9: Página pública (`/e/[slug]`) — capa, selo de confirmados e atrações

**Files:**
- Modify: `src/app/e/[slug]/page.tsx`

**Interfaces:**
- Consumes: `event.coverImageUrl`, `event.confirmedAttendees`, `event.attractions` (Task 3), `TicketPerforation` (já existente, Fase 6).

**Nota sobre testes:** sem teste automatizado próprio, mesmo padrão das demais páginas de UI. Verificação é manual, no navegador (Step 3).

- [ ] **Step 1: Substituir `src/app/e/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { findEventBySlug } from "@/lib/db/eventRepository";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TicketPerforation } from "@/components/tickets/TicketPerforation";

export default async function PublicEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const { status } = await searchParams;

  const event = await findEventBySlug(slug);
  if (!event || event.status !== "PUBLISHED") {
    notFound();
  }

  const formattedDate = event.startsAt.toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      {status === "success" && (
        <Alert className="border-success/30 bg-success/10">
          <AlertDescription className="text-success">
            Pagamento em processamento! Você receberá o ingresso por e-mail
            assim que for confirmado.
          </AlertDescription>
        </Alert>
      )}
      {status === "failure" && (
        <Alert variant="destructive">
          <AlertDescription>
            Pagamento não foi concluído. Tente novamente.
          </AlertDescription>
        </Alert>
      )}
      <Card className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
        {event.coverImageUrl && (
          <div className="relative -mx-(--card-spacing,--spacing(4)) -mt-(--card-spacing,--spacing(4)) aspect-video overflow-hidden rounded-t-xl">
            <img
              src={event.coverImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
            <h1 className="absolute inset-x-0 bottom-0 p-4 font-heading text-2xl font-semibold text-foreground">
              {event.name}
            </h1>
          </div>
        )}
        <CardHeader>
          {!event.coverImageUrl && (
            <CardTitle className="text-2xl">{event.name}</CardTitle>
          )}
          <p className="text-sm text-muted-foreground">{event.location}</p>
          <p className="font-mono text-sm text-muted-foreground">
            {formattedDate}
          </p>
          {event.confirmedAttendees != null && (
            <Badge
              variant="outline"
              className="w-fit border-success/30 bg-success/15 text-success"
            >
              {event.confirmedAttendees} confirmados
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {event.description && (
            <p className="text-sm text-foreground/90">{event.description}</p>
          )}
          {event.attractions.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Atrações
              </p>
              <div className="flex gap-4 overflow-x-auto pb-1">
                {event.attractions.map((attraction) => (
                  <div
                    key={attraction.id}
                    className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center"
                  >
                    {attraction.photoUrl ? (
                      <img
                        src={attraction.photoUrl}
                        alt=""
                        className="size-14 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-lg font-medium text-muted-foreground">
                        {attraction.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="w-full truncate text-xs text-muted-foreground">
                      {attraction.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <TicketPerforation />
          <p className="font-mono text-2xl font-semibold text-foreground">
            R$ {(event.ticketPriceCents / 100).toFixed(2)}
          </p>
          <form action="/api/checkout" method="POST" className="mt-4">
            <input type="hidden" name="eventId" value={event.id} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="buyerName">Seu nome</FieldLabel>
                <Input id="buyerName" name="buyerName" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="buyerEmail">Seu e-mail</FieldLabel>
                <Input
                  id="buyerEmail"
                  name="buyerEmail"
                  type="email"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="quantity">Quantidade</FieldLabel>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min={1}
                  max={10}
                  defaultValue={1}
                  required
                  className="font-mono"
                />
              </Field>
              <Button type="submit" className="w-full">
                Comprar ingresso
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Rodar a suíte completa e `tsc`**

Run: `npm test && npx tsc --noEmit`
Expected: PASS em ambos.

- [ ] **Step 3: Verificação manual no navegador**

Acesse a página pública (`/e/[slug]`) de um evento publicado:
- **Sem capa:** cai no layout anterior (título como `CardTitle`, sem espaço vazio).
- **Com capa cadastrada:** imagem em destaque no topo, nome do evento sobreposto na parte de baixo da imagem, cantos superiores arredondados alinhados ao card.
- **Com `confirmedAttendees` preenchido:** selo verde "N confirmados" aparece abaixo da data.
- **Com atrações cadastradas:** fileira de avatares (foto ou inicial) com nome embaixo, acima da linha de perfuração.
- O formulário de compra continua funcionando exatamente como antes (POST para `/api/checkout` inalterado).

- [ ] **Step 4: Commit**

```bash
git add "src/app/e/[slug]/page.tsx"
git commit -m "feat: show event cover, confirmed-attendees badge, and attractions on public page"
```

---

## Ao concluir

Um organizador consegue subir uma capa pro evento, cadastrar atrações com foto, e definir manualmente um número de "pessoas confirmadas" — tudo isso aparece na página pública de forma convidativa: capa em destaque com o nome sobreposto, selo de confirmados, fileira de atrações, mantendo a assinatura visual do produto (`TicketPerforation`) e o formulário de compra 100% inalterado. Upload de imagem depende de `BLOB_READ_WRITE_TOKEN` configurado (Vercel Blob) — sem ele, os formulários continuam funcionando normalmente para todos os campos que não envolvem imagem, e o upload falha com uma mensagem clara em vez de travar o formulário inteiro. Toda a lógica crítica (isolamento de tenant em `Attraction`, o padrão `null` vs `undefined` na limpeza de campos opcionais, a autorização da rota de upload) está coberta por testes automatizados contra banco real ou com o SDK do Vercel Blob mockado.
