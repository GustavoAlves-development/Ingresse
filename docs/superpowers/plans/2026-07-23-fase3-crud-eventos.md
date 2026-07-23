# Fase 3 — CRUD de Eventos (Painel do Organizador) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um `ORGANIZER_ADMIN` logado consegue listar, criar e editar (incluindo mudar o status: rascunho/publicado/encerrado) os eventos da própria organização em `/admin/events`, sem nunca ver ou conseguir editar evento de outro organizador.

**Architecture:** Server Components para leitura (list/edit carregam dados direto via repositório, sem API route) e Server Actions para escrita (create/update), validadas com Zod antes de tocar no banco — mesmo padrão já estabelecido na Fase 2 (login/signup). Toda escrita passa por `organizerId` explícito no repositório, seguindo o padrão canônico `findFirst`/`updateMany` com `{ id, organizerId }` no `where`.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Zod (já instalado na Fase 2), Prisma (já existente).

## Global Constraints

- Nomenclatura obrigatória: camelCase para variáveis, funções, rotas e colunas de banco. (spec, seção 1)
- Padrão canônico de tenant-scoping: toda leitura/escrita de recurso exige `organizerId` **e** o id do recurso juntos (`findFirst`/`updateMany` com ambos no `where`), nunca id isolado. (Fase 1, `findEventForOrganizer`)
- Decisão arquitetural confirmada com o usuário: isolamento multi-tenant continua via convenção de código (sem RLS/Prisma extension nesta fase) — reforçado por teste de isolamento em toda função de repositório nova.
- Validação de input com Zod em toda Server Action que escreve dados, antes de tocar no banco. (spec, seção 8; padrão já usado na Fase 2)
- `/admin/*` só acessível por `ORGANIZER_ADMIN` — já garantido pelo middleware da Fase 2 (`src/middleware.ts`), nenhuma mudança necessária ali.

## Escopo desta fase

Cobre: listar eventos do organizador logado, criar evento, editar evento (todos os campos + status). Não cobre: exclusão de evento, upload de imagem de capa (`coverImageUrl` fica de fora do formulário por enquanto), múltiplos tipos/lotes de ingresso, página pública de vendas (isso é Fase 4, junto com o checkout). Sem Playwright nesta fase — verificação via Vitest (lógica pura e repositório) + `npm run build` + roteiro manual do controlador via navegador real (mesmo padrão que pegou o bug crítico da Fase 2).

---

### Task 1: Geração de slug (função pura)

**Files:**
- Create: `src/lib/events/slugify.ts`
- Test: `src/lib/events/slugify.test.ts`

**Interfaces:**
- Produces: `slugify(name: string): string` — usado pela Server Action de criação de evento (Task 5).

- [ ] **Step 1: Escrever os testes que falham primeiro**

Create `src/lib/events/slugify.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    const result = slugify("Show da Banda X");
    expect(result).toMatch(/^show-da-banda-x-[a-z0-9]{6}$/);
  });

  it("removes accents", () => {
    const result = slugify("Festival de Música");
    expect(result).toMatch(/^festival-de-musica-[a-z0-9]{6}$/);
  });

  it("produces different slugs for the same name (uniqueness suffix)", () => {
    const first = slugify("Evento Repetido");
    const second = slugify("Evento Repetido");
    expect(first).not.toBe(second);
  });

  it("strips characters that are not letters, numbers, or hyphens", () => {
    const result = slugify("Evento @ 2026!");
    expect(result).toMatch(/^evento-2026-[a-z0-9]{6}$/);
  });
});
```

Also create an empty `src/lib/events/slugify.ts` (no exports yet).

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- slugify`
Expected: FAIL — `slugify` não existe.

- [ ] **Step 3: Implementar `src/lib/events/slugify.ts`**

```ts
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");

  const uniqueSuffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${uniqueSuffix}`;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- slugify`
Expected: PASS — 4 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/lib/events/slugify.ts src/lib/events/slugify.test.ts
git commit -m "feat: add slug generation for events"
```

---

### Task 2: Validação Zod para criação/edição de evento

**Files:**
- Create: `src/lib/events/eventSchema.ts`
- Test: `src/lib/events/eventSchema.test.ts`

**Interfaces:**
- Produces: `createEventSchema`, `updateEventSchema` (Zod schemas) — usados pelas Server Actions de criação (Task 5) e edição (Task 6).

- [ ] **Step 1: Escrever os testes que falham primeiro**

Create `src/lib/events/eventSchema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createEventSchema, updateEventSchema } from "./eventSchema";

const validInput = {
  name: "Show da Banda X",
  description: "Um show incrível",
  location: "Curitiba, PR",
  startsAt: "2026-12-01T20:00",
  ticketPriceReais: "50.00",
  capacity: "200",
};

describe("createEventSchema", () => {
  it("accepts valid input and coerces types", () => {
    const result = createEventSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startsAt).toBeInstanceOf(Date);
      expect(result.data.ticketPriceReais).toBe(50);
      expect(result.data.capacity).toBe(200);
    }
  });

  it("rejects missing name", () => {
    const result = createEventSchema.safeParse({ ...validInput, name: "" });

    expect(result.success).toBe(false);
  });

  it("rejects zero or negative price", () => {
    const result = createEventSchema.safeParse({
      ...validInput,
      ticketPriceReais: "0",
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-integer capacity", () => {
    const result = createEventSchema.safeParse({
      ...validInput,
      capacity: "10.5",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateEventSchema", () => {
  it("accepts valid input including status", () => {
    const result = updateEventSchema.safeParse({
      ...validInput,
      status: "PUBLISHED",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid status value", () => {
    const result = updateEventSchema.safeParse({
      ...validInput,
      status: "SOMETHING_ELSE",
    });

    expect(result.success).toBe(false);
  });
});
```

Also create an empty `src/lib/events/eventSchema.ts` (no exports yet).

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- eventSchema`
Expected: FAIL — `createEventSchema`/`updateEventSchema` não existem.

- [ ] **Step 3: Implementar `src/lib/events/eventSchema.ts`**

```ts
import { z } from "zod";

const eventFieldsSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  location: z.string().min(1, "Local é obrigatório"),
  startsAt: z.coerce.date(),
  ticketPriceReais: z.coerce
    .number()
    .positive("Preço deve ser maior que zero"),
  capacity: z.coerce.number().int().positive("Capacidade deve ser maior que zero"),
});

export const createEventSchema = eventFieldsSchema;

export const updateEventSchema = eventFieldsSchema.extend({
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]),
});
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- eventSchema`
Expected: PASS — 6 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/lib/events/eventSchema.ts src/lib/events/eventSchema.test.ts
git commit -m "feat: add Zod validation schemas for event create/update"
```

---

### Task 3: `updateEvent` no eventRepository, com isolamento multi-tenant

**Files:**
- Modify: `src/lib/db/eventRepository.ts` (adicionar função nova, não remover as existentes)
- Modify: `src/lib/db/eventRepository.test.ts` (adicionar testes novos, não remover os existentes)

**Interfaces:**
- Consumes: `prisma` de `src/lib/db/prismaClient.ts`.
- Produces: `updateEvent(organizerId: string, eventId: string, input: UpdateEventInput): Promise<boolean>` — `true` se atualizou (evento existe e pertence ao organizador), `false` caso contrário. Usado pela Server Action de edição (Task 6).

- [ ] **Step 1: Escrever os testes que falham primeiro**

Add to `src/lib/db/eventRepository.test.ts` (mantendo os testes existentes, adicione um novo `describe`):

```ts
describe("updateEvent", () => {
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

  it("updates an event belonging to the organizer", async () => {
    const event = await createEvent(organizerAId, {
      name: "Nome Original",
      slug: "nome-original",
      location: "São Paulo, SP",
      startsAt: new Date("2026-10-01T20:00:00-03:00"),
      ticketPriceCents: 3000,
      capacity: 50,
    });

    const updated = await updateEvent(organizerAId, event.id, {
      name: "Nome Atualizado",
      location: "São Paulo, SP",
      startsAt: new Date("2026-10-01T20:00:00-03:00"),
      ticketPriceCents: 4000,
      capacity: 80,
      status: "PUBLISHED",
    });

    expect(updated).toBe(true);

    const fetched = await findEventForOrganizer(organizerAId, event.id);
    expect(fetched?.name).toBe("Nome Atualizado");
    expect(fetched?.ticketPriceCents).toBe(4000);
    expect(fetched?.status).toBe("PUBLISHED");
  });

  it("does not update another organizer's event", async () => {
    const event = await createEvent(organizerAId, {
      name: "Nome Original",
      slug: "nome-original-2",
      location: "São Paulo, SP",
      startsAt: new Date("2026-10-01T20:00:00-03:00"),
      ticketPriceCents: 3000,
      capacity: 50,
    });

    const updated = await updateEvent(organizerBId, event.id, {
      name: "Nome Hackeado",
      location: "São Paulo, SP",
      startsAt: new Date("2026-10-01T20:00:00-03:00"),
      ticketPriceCents: 4000,
      capacity: 80,
      status: "PUBLISHED",
    });

    expect(updated).toBe(false);

    const fetched = await findEventForOrganizer(organizerAId, event.id);
    expect(fetched?.name).toBe("Nome Original");
  });
});
```

Add `Role` já deve estar importado se necessário — este teste não usa `Role`, então não precisa de import novo além do que o arquivo já tem.

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- eventRepository`
Expected: FAIL — `updateEvent` não existe.

- [ ] **Step 3: Implementar em `src/lib/db/eventRepository.ts`**

Add near the top of the file (alongside the existing `CreateEventInput` type):

```ts
import type { EventStatus } from "@prisma/client";
```

```ts
export type UpdateEventInput = {
  name: string;
  description?: string;
  location: string;
  startsAt: Date;
  ticketPriceCents: number;
  capacity: number;
  status: EventStatus;
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
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- eventRepository`
Expected: PASS — todos os testes do arquivo (existentes + 2 novos).

- [ ] **Step 5: Rodar a suíte completa**

Run: `npm test`
Expected: PASS — todos os testes de todos os arquivos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/eventRepository.ts src/lib/db/eventRepository.test.ts
git commit -m "feat: add tenant-scoped updateEvent with isolation tests"
```

---

### Task 4: Página de listagem de eventos + link de navegação

**Files:**
- Create: `src/app/admin/events/page.tsx`
- Modify: `src/app/admin/page.tsx` (adicionar link para `/admin/events`)

**Interfaces:**
- Consumes: `auth` de `src/auth.ts`; `listEventsByOrganizer` de `src/lib/db/eventRepository.ts` (já existe desde a Fase 1).

- [ ] **Step 1: Criar `src/app/admin/events/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listEventsByOrganizer } from "@/lib/db/eventRepository";

export default async function EventsListPage() {
  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  const events = await listEventsByOrganizer(session.user.organizerId);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Meus eventos</h1>
        <Link
          href="/admin/events/new"
          className="rounded bg-blue-600 px-3 py-2 text-white"
        >
          Novo evento
        </Link>
      </div>
      {events.length === 0 ? (
        <p>Nenhum evento criado ainda.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-center justify-between rounded border border-gray-700 p-4"
            >
              <div>
                <p className="font-medium">{event.name}</p>
                <p className="text-sm text-gray-400">
                  {event.location} — {event.status}
                </p>
              </div>
              <Link
                href={`/admin/events/${event.id}/edit`}
                className="text-blue-400 underline"
              >
                Editar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Adicionar link em `src/app/admin/page.tsx`**

Read the current file first. Add an import for `Link` from `"next/link"` at the top, and insert a link to `/admin/events` inside the `<main>`, antes do formulário de logout. O arquivo inteiro deve ficar assim:

```tsx
import Link from "next/link";
import { auth, signOut } from "@/auth";

export default async function AdminHomePage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p>
        Logado como {session?.user?.name} ({session?.user?.role})
      </p>
      <Link href="/admin/events" className="text-blue-400 underline">
        Meus eventos
      </Link>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="rounded bg-gray-700 px-3 py-2 text-white"
        >
          Sair
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Verificar que o projeto compila**

Run: `npm run build`
Expected: build conclui com sucesso; `/admin/events` aparece na listagem de rotas.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/events/page.tsx src/app/admin/page.tsx
git commit -m "feat: add events list page and admin navigation link"
```

---

### Task 5: Criar evento

**Files:**
- Create: `src/app/admin/events/new/page.tsx`

**Interfaces:**
- Consumes: `auth` de `src/auth.ts`; `createEvent` de `src/lib/db/eventRepository.ts` (já existe, Fase 1); `createEventSchema` de `src/lib/events/eventSchema.ts` (Task 2); `slugify` de `src/lib/events/slugify.ts` (Task 1).

- [ ] **Step 1: Criar `src/app/admin/events/new/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createEvent } from "@/lib/db/eventRepository";
import { createEventSchema } from "@/lib/events/eventSchema";
import { slugify } from "@/lib/events/slugify";

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
  } = parsed.data;

  await createEvent(session.user.organizerId, {
    name,
    slug: slugify(name),
    description: description || undefined,
    location,
    startsAt,
    ticketPriceCents: Math.round(ticketPriceReais * 100),
    capacity,
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
      <h1 className="mb-6 text-xl font-semibold">Novo evento</h1>
      {error && (
        <p className="mb-4 text-sm text-red-500">
          Verifique os campos preenchidos.
        </p>
      )}
      <form action={createEventAction} className="flex flex-col gap-4">
        <input
          name="name"
          placeholder="Nome do evento"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <textarea
          name="description"
          placeholder="Descrição (opcional)"
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="location"
          placeholder="Local"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="startsAt"
          type="datetime-local"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="ticketPriceReais"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="Preço do ingresso (R$)"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="capacity"
          type="number"
          step="1"
          min="1"
          placeholder="Capacidade"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-2 text-white"
        >
          Criar evento
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Verificar que o projeto compila**

Run: `npm run build`
Expected: build conclui com sucesso; `/admin/events/new` aparece na listagem de rotas.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/events/new
git commit -m "feat: add create event page"
```

---

### Task 6: Editar evento (incluindo mudança de status)

**Files:**
- Create: `src/app/admin/events/[eventId]/edit/page.tsx`

**Interfaces:**
- Consumes: `auth` de `src/auth.ts`; `findEventForOrganizer`, `updateEvent` de `src/lib/db/eventRepository.ts`; `updateEventSchema` de `src/lib/events/eventSchema.ts` (Task 2).

- [ ] **Step 1: Criar `src/app/admin/events/[eventId]/edit/page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { findEventForOrganizer, updateEvent } from "@/lib/db/eventRepository";
import { updateEventSchema } from "@/lib/events/eventSchema";

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
  } = parsed.data;

  const updated = await updateEvent(session.user.organizerId, eventId, {
    name,
    description: description || undefined,
    location,
    startsAt,
    ticketPriceCents: Math.round(ticketPriceReais * 100),
    capacity,
    status,
  });

  if (!updated) {
    notFound();
  }

  redirect("/admin/events");
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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

  const boundAction = updateEventAction.bind(null, eventId);

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-xl font-semibold">Editar evento</h1>
      {error && (
        <p className="mb-4 text-sm text-red-500">
          Verifique os campos preenchidos.
        </p>
      )}
      <form action={boundAction} className="flex flex-col gap-4">
        <input
          name="name"
          defaultValue={event.name}
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <textarea
          name="description"
          defaultValue={event.description ?? ""}
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="location"
          defaultValue={event.location}
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="startsAt"
          type="datetime-local"
          defaultValue={toDatetimeLocalValue(event.startsAt)}
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="ticketPriceReais"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={(event.ticketPriceCents / 100).toFixed(2)}
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="capacity"
          type="number"
          step="1"
          min="1"
          defaultValue={event.capacity}
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <select
          name="status"
          defaultValue={event.status}
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        >
          <option value="DRAFT">Rascunho</option>
          <option value="PUBLISHED">Publicado</option>
          <option value="CLOSED">Encerrado</option>
        </select>
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-2 text-white"
        >
          Salvar
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Verificar que o projeto compila**

Run: `npm run build`
Expected: build conclui com sucesso; `/admin/events/[eventId]/edit` aparece na listagem de rotas (dinâmica).

- [ ] **Step 3: Roteiro de verificação manual (controlador, via navegador real)**

Run: `npm run dev`, depois:
1. Login como o admin criado na Fase 2 (ou cadastre um novo em `/signup`).
2. Acesse `/admin` → clique em "Meus eventos" → deve mostrar "Nenhum evento criado ainda."
3. Clique em "Novo evento", preencha o formulário, envie. Deve redirecionar para `/admin/events` mostrando o evento criado com status `DRAFT`.
4. Clique em "Editar", mude o nome e o status para `PUBLISHED`, salve. Deve voltar pra lista mostrando o nome novo e status `PUBLISHED`.
5. Tente acessar a URL de edição de um evento com um `eventId` que não existe (ex: um UUID aleatório). Deve dar 404.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/events/[eventId]"
git commit -m "feat: add edit event page with status transitions"
```

---

## Fim da Fase 3

Ao concluir: um organizador consegue gerenciar o ciclo de vida completo de seus eventos (criar, listar, editar, publicar) sem nunca enxergar ou alterar dados de outro organizador — reforçado por testes de isolamento em `updateEvent`, seguindo o mesmo padrão canônico já estabelecido. Próxima fase: **Fase 4 — Checkout + webhook Mercado Pago + geração/envio de QR Code**, que introduz `Order`/`Ticket` como o próximo lugar onde a decisão arquitetural de isolamento multi-tenant deve ser revisitada (a spec já registra que `organizerId` denormalizado nesses dois models ainda não tem foreign key).
