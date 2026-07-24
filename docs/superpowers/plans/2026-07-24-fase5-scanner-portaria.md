# Fase 5 — Scanner de Portaria + Validação Atômica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um membro da equipe de portaria (`PORTARIA_STAFF` ou `ORGANIZER_ADMIN`) abre a página do evento em `/portaria/[eventId]`, aponta a câmera do celular para o QR Code do ingresso, e recebe feedback imediato — sucesso (ingresso marcado como usado), já utilizado (alerta de possível fraude), ou inválido — com proteção total contra reuso mesmo sob leituras concorrentes de dois scanners no mesmo instante.

**Architecture:** Uma rota de API crítica (`POST /api/tickets/validate`) recebe o `qrToken` lido pela câmera e executa um único `UPDATE` condicional (`WHERE qrToken = ? AND organizerId = ? AND status = 'VALID'`) que faz o check-and-set atomicamente — o mesmo padrão de compare-and-swap já usado em `updateEvent` (Fase 3) e `markOrderAsPaidAndCreateTickets` (Fase 4), mas aqui via SQL raw porque a transição depende do valor atual da linha, não apenas de um campo fixo. O escopo por `organizerId` acontece dentro do próprio `UPDATE` (não só depois, na autorização) — mesmo padrão canônico de `findEventForOrganizer`/`findUserForOrganizer`. A UI é um componente client-side que usa `getUserMedia` para capturar frames da câmera, decodifica QR Codes com `jsQR` num loop de `requestAnimationFrame`, e chama a API de validação a cada leitura.

**Tech Stack:** `jsqr` (decodificação de QR Code a partir de `ImageData`, roda 100% no navegador — sem app nativo, conforme spec seção 10).

## Global Constraints

- Nomenclatura obrigatória: camelCase. (spec, seção 1)
- Padrão canônico de tenant-scoping: toda busca/escrita feita a partir de uma sessão de usuário logado exige `organizerId` **e** o identificador do recurso juntos na mesma query (`findFirst`/`UPDATE ... WHERE`), nunca por id isolado. (spec, seção 8; já estabelecido em `findEventForOrganizer`, `findUserForOrganizer`)
- **Idempotência/concorrência via UPDATE atômico condicional** — check-and-set numa única instrução, sem `SELECT ... FOR UPDATE`, sem lock explícito, sem infraestrutura externa. (spec, seção 6, decisão de escopo)
- `qrToken` é o único identificador aceito publicamente para um ingresso — nunca o `id` interno. (spec, seção 4)
- Toda rota de API valida sessão do Auth.js antes de ler/escrever dado de qualquer tenant. (spec, seção 8)

## Escopo desta fase

Cobre: rota de validação atômica de ingresso (`/api/tickets/validate`), listagem de eventos para a portaria, página do scanner por evento (`/portaria/[eventId]`), componente de captura de câmera + decodificação de QR Code, feedback visual de sucesso/já-usado/inválido.

Não cobre: tema visual definitivo — cores exatas de glow/pulso (Fase 6, spec seção 7); testes automatizados de ponta a ponta com câmera real (Playwright não está configurado no projeto; a verificação da captura de câmera é manual, via navegador, mesma limitação já registrada na Fase 4 para o round-trip real do Mercado Pago); múltiplos leitores simultâneos na mesma página (um scanner por sessão de navegador é suficiente).

**Sobre testes desta fase:** a lógica crítica (UPDATE atômico, escopo por tenant, concorrência) roda contra o banco de teste real (mesmo padrão de `orderRepository.test.ts`) e é 100% testável com Vitest. A captura de câmera (`getUserMedia`) e o loop de decodificação (`jsQR` + `<canvas>`) dependem de APIs de navegador inexistentes no ambiente de teste (`environment: "node"` no `vitest.config.ts`) — verificação é manual, abrindo `/portaria/[eventId]` num navegador com câmera.

---

### Task 1: Validação atômica de ingresso (`ticketRepository`)

**Files:**
- Create: `src/lib/db/ticketRepository.ts`
- Test: `src/lib/db/ticketRepository.test.ts`

**Interfaces:**
- Consumes: `prisma` de `src/lib/db/prismaClient.ts` (padrão já usado em `orderRepository.ts`, `eventRepository.ts`).
- Produces: `validateTicketForOrganizer(organizerId: string, qrToken: string, staffUserId: string): Promise<{ result: CheckInResult; ticket: Ticket | null }>` — usado pela rota de API na Task 2. `CheckInResult` e `Ticket` são tipos do `@prisma/client`.

- [ ] **Step 1: Escrever os testes que falham primeiro**

Create `src/lib/db/ticketRepository.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../../tests/testDb";
import { validateTicketForOrganizer } from "./ticketRepository";

describe("validateTicketForOrganizer", () => {
  let organizerId: string;
  let staffUserId: string;
  let eventId: string;
  let orderId: string;

  beforeEach(async () => {
    await resetDatabase();

    const organizer = await testPrisma.organizer.create({
      data: { name: "Organizador Teste", email: "org@teste.dev" },
    });
    organizerId = organizer.id;

    const staff = await testPrisma.user.create({
      data: {
        organizerId,
        name: "Staff Teste",
        email: "staff@teste.dev",
        passwordHash: "hash-fake",
        role: "PORTARIA_STAFF",
      },
    });
    staffUserId = staff.id;

    const event = await testPrisma.event.create({
      data: {
        organizerId,
        name: "Show de Teste",
        slug: "show-portaria-teste",
        location: "São Paulo, SP",
        startsAt: new Date("2026-12-01T23:00:00.000Z"),
        ticketPriceCents: 5000,
        capacity: 100,
        status: "PUBLISHED",
      },
    });
    eventId = event.id;

    const order = await testPrisma.order.create({
      data: {
        eventId,
        organizerId,
        buyerName: "Comprador Teste",
        buyerEmail: "comprador@teste.dev",
        quantity: 1,
        totalAmountCents: 5000,
        status: "PAID",
      },
    });
    orderId = order.id;
  });

  async function createTicket(qrToken: string) {
    return testPrisma.ticket.create({
      data: {
        eventId,
        organizerId,
        orderId,
        qrToken,
        buyerName: "Comprador Teste",
        status: "VALID",
      },
    });
  }

  it("marks a valid ticket as used and logs a SUCCESS check-in attempt", async () => {
    const ticket = await createTicket("token-valido-001");

    const { result, ticket: updated } = await validateTicketForOrganizer(
      organizerId,
      ticket.qrToken,
      staffUserId,
    );

    expect(result).toBe("SUCCESS");
    expect(updated?.status).toBe("USED");
    expect(updated?.usedByUserId).toBe(staffUserId);

    const attempts = await testPrisma.checkInAttempt.findMany({
      where: { ticketId: ticket.id },
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].result).toBe("SUCCESS");
  });

  it("returns ALREADY_USED for a ticket that was already validated", async () => {
    const ticket = await createTicket("token-ja-usado-001");
    await validateTicketForOrganizer(organizerId, ticket.qrToken, staffUserId);

    const { result, ticket: found } = await validateTicketForOrganizer(
      organizerId,
      ticket.qrToken,
      staffUserId,
    );

    expect(result).toBe("ALREADY_USED");
    expect(found?.status).toBe("USED");

    const attempts = await testPrisma.checkInAttempt.findMany({
      where: { ticketId: ticket.id },
    });
    expect(attempts).toHaveLength(2);
    expect(attempts[1].result).toBe("ALREADY_USED");
  });

  it("returns INVALID for a qrToken that does not exist", async () => {
    const { result, ticket } = await validateTicketForOrganizer(
      organizerId,
      "token-que-nao-existe",
      staffUserId,
    );

    expect(result).toBe("INVALID");
    expect(ticket).toBeNull();
  });

  it("returns INVALID for a ticket that belongs to another organizer", async () => {
    const otherOrganizer = await testPrisma.organizer.create({
      data: { name: "Outro Organizador", email: "outro@teste.dev" },
    });
    const otherEvent = await testPrisma.event.create({
      data: {
        organizerId: otherOrganizer.id,
        name: "Outro Show",
        slug: "outro-show-portaria-teste",
        location: "Rio de Janeiro, RJ",
        startsAt: new Date("2026-12-01T23:00:00.000Z"),
        ticketPriceCents: 3000,
        capacity: 50,
        status: "PUBLISHED",
      },
    });
    const otherOrder = await testPrisma.order.create({
      data: {
        eventId: otherEvent.id,
        organizerId: otherOrganizer.id,
        buyerName: "Outro Comprador",
        buyerEmail: "outro-comprador@teste.dev",
        quantity: 1,
        totalAmountCents: 3000,
        status: "PAID",
      },
    });
    const otherTicket = await testPrisma.ticket.create({
      data: {
        eventId: otherEvent.id,
        organizerId: otherOrganizer.id,
        orderId: otherOrder.id,
        qrToken: "token-de-outro-organizador",
        buyerName: "Outro Comprador",
        status: "VALID",
      },
    });

    const { result, ticket } = await validateTicketForOrganizer(
      organizerId,
      otherTicket.qrToken,
      staffUserId,
    );

    expect(result).toBe("INVALID");
    expect(ticket).toBeNull();

    const attempts = await testPrisma.checkInAttempt.findMany({
      where: { ticketId: otherTicket.id },
    });
    expect(attempts).toHaveLength(0);
  });

  it("is safe under real concurrency: two simultaneous reads of the same qrToken only succeed once", async () => {
    const ticket = await createTicket("token-concorrente-001");

    const [first, second] = await Promise.all([
      validateTicketForOrganizer(organizerId, ticket.qrToken, staffUserId),
      validateTicketForOrganizer(organizerId, ticket.qrToken, staffUserId),
    ]);

    const successes = [first, second].filter((r) => r.result === "SUCCESS");
    const alreadyUsed = [first, second].filter(
      (r) => r.result === "ALREADY_USED",
    );
    expect(successes).toHaveLength(1);
    expect(alreadyUsed).toHaveLength(1);

    const finalTicket = await testPrisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    expect(finalTicket.status).toBe("USED");
  });
});
```

Also create empty `src/lib/db/ticketRepository.ts` (no exports yet).

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- ticketRepository`
Expected: FAIL — `validateTicketForOrganizer` não existe.

- [ ] **Step 3: Implementar `src/lib/db/ticketRepository.ts`**

```ts
import type { CheckInResult, Ticket } from "@prisma/client";
import { prisma } from "./prismaClient";

export async function validateTicketForOrganizer(
  organizerId: string,
  qrToken: string,
  staffUserId: string,
): Promise<{ result: CheckInResult; ticket: Ticket | null }> {
  // UPDATE atômico condicional: uma única instrução SQL faz o check-and-set.
  // O Postgres serializa via row lock implícito do próprio UPDATE — se duas
  // leituras concorrentes chegarem com o mesmo qrToken, só uma encontra
  // status = 'VALID' e afeta a linha (spec, seção 6). Escopar por
  // organizerId dentro do próprio UPDATE (não só depois) impede que staff
  // de um organizador valide — ou apenas descubra a existência de — um
  // ingresso de outro tenant.
  const updatedTickets = await prisma.$queryRaw<Ticket[]>`
    UPDATE "Ticket"
    SET "status" = 'USED', "usedAt" = now(), "usedByUserId" = ${staffUserId}
    WHERE "qrToken" = ${qrToken} AND "organizerId" = ${organizerId} AND "status" = 'VALID'
    RETURNING *
  `;
  const updatedTicket = updatedTickets[0];

  if (updatedTicket) {
    await prisma.checkInAttempt.create({
      data: {
        ticketId: updatedTicket.id,
        scannedByUserId: staffUserId,
        result: "SUCCESS",
      },
    });
    return { result: "SUCCESS", ticket: updatedTicket };
  }

  // updatedTicket vazio: token não existe para este organizador OU já foi
  // usado. Esta leitura extra só decide a mensagem — o UPDATE atômico acima
  // já decidiu o resultado real, não há race condition aqui (mesmo padrão
  // documentado na spec, seção 6).
  const existing = await prisma.ticket.findFirst({
    where: { qrToken, organizerId },
  });

  const result: CheckInResult = existing ? "ALREADY_USED" : "INVALID";
  if (existing) {
    await prisma.checkInAttempt.create({
      data: { ticketId: existing.id, scannedByUserId: staffUserId, result },
    });
  }

  return { result, ticket: existing };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- ticketRepository`
Expected: PASS — 5 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/ticketRepository.ts src/lib/db/ticketRepository.test.ts
git commit -m "feat: add atomic ticket validation with tenant-scoped check-and-set"
```

---

### Task 2: Rota de API `POST /api/tickets/validate`

**Files:**
- Create: `src/app/api/tickets/validate/route.ts`
- Test: `src/app/api/tickets/validate/route.test.ts`

**Interfaces:**
- Consumes: `auth()` de `src/auth.ts` (retorna `{ user: { id, organizerId, role } } | null`, mesmo shape usado em `src/app/admin/events/page.tsx`); `validateTicketForOrganizer` da Task 1.
- Produces: `POST` handler que responde `{ result: "SUCCESS" | "ALREADY_USED" | "INVALID", buyerName: string | null }` — consumido pelo componente `QrScanner` na Task 3.

- [ ] **Step 1: Escrever os testes que falham primeiro**

Create `src/app/api/tickets/validate/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDatabase, testPrisma } from "../../../../../tests/testDb";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: authMock,
}));

const { POST } = await import("./route");

function buildRequest(qrToken: unknown) {
  return new Request("http://localhost/api/tickets/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ qrToken }),
  });
}

describe("POST /api/tickets/validate", () => {
  let organizerId: string;
  let staffUserId: string;
  let eventId: string;
  let orderId: string;

  beforeEach(async () => {
    await resetDatabase();
    authMock.mockReset();

    const organizer = await testPrisma.organizer.create({
      data: { name: "Organizador Teste", email: "org@teste.dev" },
    });
    organizerId = organizer.id;

    const staff = await testPrisma.user.create({
      data: {
        organizerId,
        name: "Staff Teste",
        email: "staff@teste.dev",
        passwordHash: "hash-fake",
        role: "PORTARIA_STAFF",
      },
    });
    staffUserId = staff.id;

    const event = await testPrisma.event.create({
      data: {
        organizerId,
        name: "Show de Teste",
        slug: "show-validate-route-teste",
        location: "São Paulo, SP",
        startsAt: new Date("2026-12-01T23:00:00.000Z"),
        ticketPriceCents: 5000,
        capacity: 100,
        status: "PUBLISHED",
      },
    });
    eventId = event.id;

    const order = await testPrisma.order.create({
      data: {
        eventId,
        organizerId,
        buyerName: "Comprador Teste",
        buyerEmail: "comprador@teste.dev",
        quantity: 1,
        totalAmountCents: 5000,
        status: "PAID",
      },
    });
    orderId = order.id;
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(buildRequest("qualquer-token"));

    expect(response.status).toBe(401);
  });

  it("returns 400 for an empty qrToken", async () => {
    authMock.mockResolvedValue({
      user: { id: staffUserId, organizerId, role: "PORTARIA_STAFF" },
    });

    const response = await POST(buildRequest(""));

    expect(response.status).toBe(400);
  });

  it("validates a valid ticket and returns SUCCESS with the buyer name", async () => {
    authMock.mockResolvedValue({
      user: { id: staffUserId, organizerId, role: "PORTARIA_STAFF" },
    });
    const ticket = await testPrisma.ticket.create({
      data: {
        eventId,
        organizerId,
        orderId,
        qrToken: "token-valido-rota-001",
        buyerName: "Comprador Teste",
        status: "VALID",
      },
    });

    const response = await POST(buildRequest(ticket.qrToken));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result).toBe("SUCCESS");
    expect(body.buyerName).toBe("Comprador Teste");
  });

  it("does not validate a ticket belonging to another organizer", async () => {
    const otherOrganizer = await testPrisma.organizer.create({
      data: { name: "Outro Organizador", email: "outro-rota@teste.dev" },
    });
    const otherEvent = await testPrisma.event.create({
      data: {
        organizerId: otherOrganizer.id,
        name: "Outro Show",
        slug: "outro-show-validate-route-teste",
        location: "Rio de Janeiro, RJ",
        startsAt: new Date("2026-12-01T23:00:00.000Z"),
        ticketPriceCents: 3000,
        capacity: 50,
        status: "PUBLISHED",
      },
    });
    const otherOrder = await testPrisma.order.create({
      data: {
        eventId: otherEvent.id,
        organizerId: otherOrganizer.id,
        buyerName: "Outro Comprador",
        buyerEmail: "outro-comprador-rota@teste.dev",
        quantity: 1,
        totalAmountCents: 3000,
        status: "PAID",
      },
    });
    const otherTicket = await testPrisma.ticket.create({
      data: {
        eventId: otherEvent.id,
        organizerId: otherOrganizer.id,
        orderId: otherOrder.id,
        qrToken: "token-de-outro-organizador-rota",
        buyerName: "Outro Comprador",
        status: "VALID",
      },
    });

    authMock.mockResolvedValue({
      user: { id: staffUserId, organizerId, role: "PORTARIA_STAFF" },
    });

    const response = await POST(buildRequest(otherTicket.qrToken));
    const body = await response.json();

    expect(body.result).toBe("INVALID");
    expect(body.buyerName).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- src/app/api/tickets/validate`
Expected: FAIL — o módulo `./route` não existe.

- [ ] **Step 3: Implementar `src/app/api/tickets/validate/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { validateTicketForOrganizer } from "@/lib/db/ticketRepository";

const validateSchema = z.object({
  qrToken: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = validateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const { result, ticket } = await validateTicketForOrganizer(
    session.user.organizerId,
    parsed.data.qrToken,
    session.user.id,
  );

  return NextResponse.json({ result, buyerName: ticket?.buyerName ?? null });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- src/app/api/tickets/validate`
Expected: PASS — 4 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tickets/validate/route.ts src/app/api/tickets/validate/route.test.ts
git commit -m "feat: add authenticated ticket validation API route"
```

---

### Task 3: Componente de captura de câmera + decodificação de QR Code

**Files:**
- Create: `src/components/portaria/QrScanner.tsx`
- Modify: `package.json` (dependência `jsqr`)

**Interfaces:**
- Consumes: `POST /api/tickets/validate` da Task 2 (via `fetch`), respondendo `{ result, buyerName }`.
- Produces: `<QrScanner />` — componente client-side sem props, usado pela página da Task 4.

**Nota sobre testes:** este componente depende de `getUserMedia`, `<video>` e `<canvas>` reais — indisponíveis no ambiente de teste (`environment: "node"`, sem DOM/câmera). Verificação é manual (Task 4, Step de verificação). Não há teste automatizado para este arquivo, mesmo padrão de páginas/componentes de UI já existentes no projeto (`src/app/login/page.tsx`, páginas de `src/app/admin`).

- [ ] **Step 1: Instalar dependência**

Run: `npm install jsqr`
Expected: instala sem erros. (`jsqr` já publica seus próprios tipos em `dist/index.d.ts`, sem necessidade de `@types/jsqr`.)

- [ ] **Step 2: Implementar `src/components/portaria/QrScanner.tsx`**

```tsx
"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";

type ScanResult = {
  result: "SUCCESS" | "ALREADY_USED" | "INVALID";
  buyerName: string | null;
};

const RESULT_STYLES: Record<ScanResult["result"], string> = {
  SUCCESS:
    "border-green-500 bg-green-950 text-green-400 shadow-[0_0_30px_rgba(34,197,94,0.5)]",
  ALREADY_USED:
    "border-red-500 bg-red-950 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.5)] animate-pulse",
  INVALID:
    "border-red-500 bg-red-950 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.5)] animate-pulse",
};

const RESULT_LABELS: Record<ScanResult["result"], string> = {
  SUCCESS: "Ingresso válido",
  ALREADY_USED: "Ingresso já utilizado",
  INVALID: "Ingresso inválido",
};

export function QrScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanResultRef = useRef<ScanResult | null>(null);
  const validatingRef = useRef(false);

  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    scanResultRef.current = scanResult;
  }, [scanResult]);

  const validateToken = useCallback(async (qrToken: string) => {
    validatingRef.current = true;
    try {
      const response = await fetch("/api/tickets/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ qrToken }),
      });
      const body = await response.json();
      setScanResult({ result: body.result, buyerName: body.buyerName ?? null });
    } finally {
      validatingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    let stream: MediaStream | null = null;
    let cancelled = false;

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (
        video &&
        canvas &&
        video.readyState === video.HAVE_ENOUGH_DATA &&
        !scanResultRef.current &&
        !validatingRef.current
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            void validateToken(code.data);
          }
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    }

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        animationFrameId = requestAnimationFrame(tick);
      } catch {
        setCameraError("Não foi possível acessar a câmera.");
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrameId);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [validateToken]);

  return (
    <div className="flex flex-col gap-4">
      {cameraError && <p className="text-sm text-red-500">{cameraError}</p>}
      <video ref={videoRef} muted playsInline className="w-full rounded" />
      <canvas ref={canvasRef} className="hidden" />
      {scanResult && (
        <div
          className={`rounded border-2 p-4 text-center text-lg font-semibold ${RESULT_STYLES[scanResult.result]}`}
        >
          <p>{RESULT_LABELS[scanResult.result]}</p>
          {scanResult.buyerName && (
            <p className="text-base font-normal">{scanResult.buyerName}</p>
          )}
          <button
            type="button"
            onClick={() => setScanResult(null)}
            className="mt-4 rounded bg-blue-600 px-3 py-2 text-sm font-normal text-white"
          >
            Escanear próximo
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Rodar a suíte completa e confirmar que nada quebrou**

Run: `npm test`
Expected: PASS — todos os testes existentes continuam passando (este arquivo não tem teste próprio, ver nota acima).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/portaria/QrScanner.tsx
git commit -m "feat: add camera-based QR scanner component"
```

---

### Task 4: Páginas da portaria (lista de eventos + scanner por evento)

**Files:**
- Modify: `src/app/portaria/page.tsx`
- Create: `src/app/portaria/[eventId]/page.tsx`

**Interfaces:**
- Consumes: `auth()` de `src/auth.ts`; `listEventsByOrganizer`/`findEventForOrganizer` de `src/lib/db/eventRepository.ts` (já existentes, Fase 3); `<QrScanner />` da Task 3.

**Nota sobre testes:** páginas de UI seguem o mesmo padrão já estabelecido no projeto (`src/app/admin/events/page.tsx`, `src/app/e/[slug]/page.tsx`) — sem teste automatizado próprio. A verificação é manual, no navegador (Step 3).

- [ ] **Step 1: Substituir `src/app/portaria/page.tsx` pela lista de eventos**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listEventsByOrganizer } from "@/lib/db/eventRepository";

export default async function PortariaEventsListPage() {
  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  const events = await listEventsByOrganizer(session.user.organizerId);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-xl font-semibold">Portaria</h1>
      {events.length === 0 ? (
        <p>Nenhum evento criado ainda.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id} className="rounded border border-gray-700 p-4">
              <Link
                href={`/portaria/${event.id}`}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{event.name}</p>
                  <p className="text-sm text-gray-400">
                    {event.location} — {event.status}
                  </p>
                </div>
                <span className="text-blue-400 underline">
                  Validar ingressos
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Criar `src/app/portaria/[eventId]/page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { findEventForOrganizer } from "@/lib/db/eventRepository";
import { QrScanner } from "@/components/portaria/QrScanner";

export default async function PortariaScannerPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  const { eventId } = await params;
  const event = await findEventForOrganizer(session.user.organizerId, eventId);
  if (!event) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-xl font-semibold">{event.name}</h1>
      <QrScanner />
    </main>
  );
}
```

- [ ] **Step 3: Verificação manual no navegador**

Run: `npm run dev`, faça login como um usuário `PORTARIA_STAFF` ou `ORGANIZER_ADMIN`, acesse `/portaria`.
Expected: lista os eventos do organizador logado. Ao clicar em "Validar ingressos", abre `/portaria/[eventId]`, o navegador pede permissão de câmera, e a imagem da câmera aparece na tela.

Aponte a câmera para um QR Code de um ingresso válido (gerado via fluxo de compra da Fase 4, ou criado diretamente no banco de teste).
Expected: aparece o card verde "Ingresso válido" com o nome do comprador. Escanear o mesmo QR Code de novo (após clicar "Escanear próximo") mostra o card vermelho pulsante "Ingresso já utilizado".

- [ ] **Step 4: Rodar a suíte completa**

Run: `npm test`
Expected: PASS — todos os testes (Tasks 1–4 anteriores incluídas) passando.

- [ ] **Step 5: Commit**

```bash
git add src/app/portaria/page.tsx "src/app/portaria/[eventId]/page.tsx"
git commit -m "feat: add portaria scanner pages (event list + per-event QR scanner)"
```

---

## Ao concluir

Um membro da equipe de portaria consegue listar os eventos do seu organizador, abrir o scanner de um evento específico, e validar ingressos apontando a câmera do celular para o QR Code — com o `UPDATE` atômico condicional garantindo que, mesmo sob duas leituras concorrentes do mesmo QR Code, apenas uma seja aceita como sucesso. Toda a lógica crítica (check-and-set atômico, escopo por tenant, concorrência) está coberta por testes automatizados contra banco real. A captura de câmera e decodificação de QR Code em si só são verificáveis manualmente num navegador com câmera — registrar isso como pré-requisito de teste de aceitação, mesma ressalva já usada na Fase 4 para o round-trip real do Mercado Pago. Próxima fase: **Fase 6 — Tema visual definitivo** (cores, glow, ícones — spec seção 7 na íntegra).
