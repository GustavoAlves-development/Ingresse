# Fase 4 — Checkout + Webhook Mercado Pago + QR Code + E-mail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um comprador acessa a página pública de um evento publicado, compra um ingresso via Mercado Pago; ao pagamento ser confirmado (webhook, com verificação de assinatura e idempotência), o sistema gera um QR Code único por ingresso e envia por e-mail.

**Architecture:** Página pública SSR (`/e/[slug]`) → formulário POST para uma API Route (`/api/checkout`) que recalcula o preço no servidor (nunca confia em valor vindo do cliente) e cria uma *preference* no Mercado Pago → redireciona o comprador. O Mercado Pago notifica `/api/webhooks/mercadopago`, que valida a assinatura, rebusca o pagamento na API do Mercado Pago (nunca confia no corpo da notificação), e processa via um UPDATE atômico condicional (`status = 'PENDING' → 'PAID'`) — o mesmo padrão de compare-and-swap já usado em `updateEvent` — garantindo idempotência sem lock explícito.

**Tech Stack:** `mercadopago` (SDK oficial), `resend` (e-mail transacional, suporta JSX diretamente sem pacote adicional), `qrcode` (geração de imagem), `nanoid` (token opaco do ingresso).

## Global Constraints

- Nomenclatura obrigatória: camelCase. (spec, seção 1)
- Padrão canônico de tenant-scoping para leitura/escrita **feita por um usuário logado**: `organizerId` + id do recurso juntos. **Não se aplica** a `findEventById`/`findEventBySlug` desta fase — são lookups de processos de sistema (webhook, checkout) ou públicos (página de vendas), não de sessão de organizador; o próprio `eventId`/`slug` já veio de um registro nosso confiável, não de input arbitrário de usuário autenticado tentando acessar dado de outro tenant.
- **Preço nunca vem do cliente.** O valor cobrado (`totalAmountCents`) é sempre recalculado no servidor a partir de `event.ticketPriceCents * quantity`, nunca aceito como campo de formulário.
- **Webhook nunca confia no corpo da notificação.** Sempre valida a assinatura (`x-signature`/`x-request-id` do Mercado Pago) e rebusca o pagamento na API oficial antes de agir. (spec, seção 6)
- **Idempotência via UPDATE atômico condicional**, mesmo padrão de `updateEvent` (Fase 3) e da validação de ticket (spec, seção 6): `updateMany({ where: { id, status: 'PENDING' }, data: {...} })`, checando `count`. Notificação duplicada do Mercado Pago não deve duplicar tickets nem reenviar e-mail.
- `qrToken` é um token opaco (`nanoid(32)`), nunca o `id` interno do `Ticket`. (spec, seção 4)

## Escopo desta fase

Cobre: página pública de evento publicado, checkout (criação de Order + preference Mercado Pago), webhook com verificação de assinatura + idempotência + criação de tickets, geração de QR Code, envio de e-mail via Resend. Não cobre: scanner de portaria (Fase 5), tema visual definitivo (Fase 6), reembolso, múltiplos lotes/tipos de ingresso.

**Sobre testes desta fase:** não há túnel público (ngrok) configurado — por decisão do usuário, o teste do webhook nesta fase é via requisições construídas diretamente contra o route handler (simulando o que o Mercado Pago enviaria), com o SDK do Mercado Pago e o Resend mockados nos testes automatizados. O round-trip real (Mercado Pago de verdade chamando o webhook) só é possível com o app publicamente acessível — fica para quando houver deploy.

**Pré-requisitos externos (contas a criar quando a task pedir, mesmo fluxo do Neon na Fase 1):**
- Conta no [Mercado Pago Developers](https://www.mercadopago.com.br/developers) → aplicação de teste → `Access Token` de teste e `Webhook Secret` (configurado na seção de notificações da aplicação).
- Conta no [Resend](https://resend.com) → `API Key`.

---

### Task 1: Essenciais do QR Code (token + imagem)

**Files:**
- Create: `src/lib/tickets/qrToken.ts`
- Create: `src/lib/tickets/qrCode.ts`
- Test: `src/lib/tickets/qrToken.test.ts`
- Test: `src/lib/tickets/qrCode.test.ts`

**Interfaces:**
- Produces: `generateQrToken(): string` (usado por `markOrderAsPaidAndCreateTickets`, Task 2); `generateQrCodeDataUrl(token: string): Promise<string>` (usado pelo webhook, Task 8).

- [ ] **Step 1: Instalar dependências**

Run: `npm install nanoid qrcode && npm install -D @types/qrcode`
Expected: instala sem erros.

- [ ] **Step 2: Escrever os testes que falham primeiro**

Create `src/lib/tickets/qrToken.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateQrToken } from "./qrToken";

describe("generateQrToken", () => {
  it("generates a 32-character opaque token", () => {
    const token = generateQrToken();

    expect(token).toHaveLength(32);
  });

  it("generates a different token on each call", () => {
    const first = generateQrToken();
    const second = generateQrToken();

    expect(first).not.toBe(second);
  });
});
```

Create `src/lib/tickets/qrCode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateQrCodeDataUrl } from "./qrCode";

describe("generateQrCodeDataUrl", () => {
  it("generates a PNG data URL for a token", async () => {
    const dataUrl = await generateQrCodeDataUrl("some-opaque-token-12345678901234");

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
```

Also create empty `src/lib/tickets/qrToken.ts` and `src/lib/tickets/qrCode.ts` (no exports yet).

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `npm test -- qrToken qrCode`
Expected: FAIL — `generateQrToken`/`generateQrCodeDataUrl` não existem.

- [ ] **Step 4: Implementar `src/lib/tickets/qrToken.ts`**

```ts
import { nanoid } from "nanoid";

export function generateQrToken(): string {
  return nanoid(32);
}
```

- [ ] **Step 5: Implementar `src/lib/tickets/qrCode.ts`**

```ts
import QRCode from "qrcode";

export async function generateQrCodeDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token);
}
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `npm test -- qrToken qrCode`
Expected: PASS — 3 testes passando.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/tickets/qrToken.ts src/lib/tickets/qrToken.test.ts src/lib/tickets/qrCode.ts src/lib/tickets/qrCode.test.ts
git commit -m "feat: add QR token generation and QR code image rendering"
```

---

### Task 2: `orderRepository` — criação de pedido e processamento idempotente de pagamento

**Files:**
- Create: `src/lib/db/orderRepository.ts`
- Test: `src/lib/db/orderRepository.test.ts`

**Interfaces:**
- Consumes: `prisma` de `src/lib/db/prismaClient.ts`; `generateQrToken` de `src/lib/tickets/qrToken.ts` (Task 1).
- Produces: `createOrder(input): Promise<Order>`; `findOrderById(orderId): Promise<Order | null>`; `markOrderAsPaidAndCreateTickets(params: { orderId: string; mercadoPagoPaymentId: string }): Promise<{ alreadyProcessed: true } | { alreadyProcessed: false; order: Order; tickets: Ticket[] }>` — usado pelo webhook (Task 8).

- [ ] **Step 1: Escrever os testes que falham primeiro**

Create `src/lib/db/orderRepository.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../../tests/testDb";
import {
  createOrder,
  findOrderById,
  markOrderAsPaidAndCreateTickets,
} from "./orderRepository";

describe("orderRepository", () => {
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
        slug: "show-de-teste",
        location: "São Paulo, SP",
        startsAt: new Date("2026-12-01T23:00:00.000Z"),
        ticketPriceCents: 5000,
        capacity: 100,
        status: "PUBLISHED",
      },
    });
    eventId = event.id;
  });

  describe("createOrder", () => {
    it("creates a pending order with organizerId denormalized from the event", async () => {
      const order = await createOrder({
        eventId,
        organizerId,
        buyerName: "Comprador Teste",
        buyerEmail: "comprador@teste.dev",
        quantity: 2,
        totalAmountCents: 10000,
      });

      expect(order.status).toBe("PENDING");
      expect(order.organizerId).toBe(organizerId);
    });
  });

  describe("markOrderAsPaidAndCreateTickets", () => {
    it("marks the order as paid and creates one ticket per quantity unit", async () => {
      const order = await createOrder({
        eventId,
        organizerId,
        buyerName: "Comprador Teste",
        buyerEmail: "comprador@teste.dev",
        quantity: 2,
        totalAmountCents: 10000,
      });

      const result = await markOrderAsPaidAndCreateTickets({
        orderId: order.id,
        mercadoPagoPaymentId: "mp-payment-123",
      });

      expect(result.alreadyProcessed).toBe(false);
      if (!result.alreadyProcessed) {
        expect(result.order.status).toBe("PAID");
        expect(result.tickets).toHaveLength(2);
        expect(result.tickets[0].organizerId).toBe(organizerId);
        expect(result.tickets[0].eventId).toBe(eventId);
        expect(result.tickets[0].status).toBe("VALID");
        expect(result.tickets[0].qrToken).not.toBe(result.tickets[1].qrToken);
      }
    });

    it("is idempotent: processing the same payment twice does not duplicate tickets", async () => {
      const order = await createOrder({
        eventId,
        organizerId,
        buyerName: "Comprador Teste",
        buyerEmail: "comprador@teste.dev",
        quantity: 1,
        totalAmountCents: 5000,
      });

      const first = await markOrderAsPaidAndCreateTickets({
        orderId: order.id,
        mercadoPagoPaymentId: "mp-payment-456",
      });
      const second = await markOrderAsPaidAndCreateTickets({
        orderId: order.id,
        mercadoPagoPaymentId: "mp-payment-456",
      });

      expect(first.alreadyProcessed).toBe(false);
      expect(second.alreadyProcessed).toBe(true);

      const ticketCount = await testPrisma.ticket.count({
        where: { orderId: order.id },
      });
      expect(ticketCount).toBe(1);
    });
  });

  describe("findOrderById", () => {
    it("returns null for a nonexistent order", async () => {
      const found = await findOrderById(crypto.randomUUID());

      expect(found).toBeNull();
    });
  });
});
```

Also create an empty `src/lib/db/orderRepository.ts` (no exports yet).

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- orderRepository`
Expected: FAIL — as funções não existem.

- [ ] **Step 3: Implementar `src/lib/db/orderRepository.ts`**

```ts
import { OrderStatus, TicketStatus } from "@prisma/client";
import { generateQrToken } from "../tickets/qrToken";
import { prisma } from "./prismaClient";

type CreateOrderInput = {
  eventId: string;
  organizerId: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  totalAmountCents: number;
};

export async function createOrder(input: CreateOrderInput) {
  return prisma.order.create({ data: input });
}

export async function findOrderById(orderId: string) {
  return prisma.order.findUnique({ where: { id: orderId } });
}

export async function markOrderAsPaidAndCreateTickets(params: {
  orderId: string;
  mercadoPagoPaymentId: string;
}) {
  return prisma.$transaction(async (tx) => {
    // UPDATE atômico condicional: só transiciona PENDING -> PAID. Se o
    // Mercado Pago reenviar a mesma notificação, a segunda tentativa
    // encontra status já diferente de PENDING e não afeta nenhuma linha —
    // idempotência sem lock explícito, mesmo padrão de updateEvent (Fase 3).
    const updateResult = await tx.order.updateMany({
      where: { id: params.orderId, status: OrderStatus.PENDING },
      data: {
        status: OrderStatus.PAID,
        paidAt: new Date(),
        mercadoPagoPaymentId: params.mercadoPagoPaymentId,
      },
    });

    if (updateResult.count === 0) {
      return { alreadyProcessed: true as const };
    }

    const order = await tx.order.findUniqueOrThrow({
      where: { id: params.orderId },
    });

    const tickets = await Promise.all(
      Array.from({ length: order.quantity }, () =>
        tx.ticket.create({
          data: {
            eventId: order.eventId,
            organizerId: order.organizerId,
            orderId: order.id,
            qrToken: generateQrToken(),
            buyerName: order.buyerName,
            status: TicketStatus.VALID,
          },
        }),
      ),
    );

    return { alreadyProcessed: false as const, order, tickets };
  });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- orderRepository`
Expected: PASS — 4 testes passando.

- [ ] **Step 5: Rodar a suíte completa**

Run: `npm test`
Expected: PASS — todos os testes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/orderRepository.ts src/lib/db/orderRepository.test.ts
git commit -m "feat: add orderRepository with idempotent payment processing"
```

---

### Task 3: `eventRepository` — lookups públicos/de sistema (`findEventById`, `findEventBySlug`)

**Files:**
- Modify: `src/lib/db/eventRepository.ts` (adicionar funções novas, não remover as existentes)
- Modify: `src/lib/db/eventRepository.test.ts` (adicionar testes novos, não remover os existentes)

**Interfaces:**
- Produces: `findEventById(eventId: string): Promise<Event | null>` (usado pelo webhook e pelo checkout, Tasks 7 e 8 — processos de sistema que já têm o `eventId` de um registro confiável nosso, não de sessão de usuário); `findEventBySlug(slug: string): Promise<Event | null>` (usado pela página pública, Task 6 — lookup público, qualquer visitante pode ver um evento publicado pelo slug).

- [ ] **Step 1: Escrever os testes que falham primeiro**

Add to `src/lib/db/eventRepository.test.ts` (mantendo os testes existentes). **Importante:** este novo `describe` usa `organizerAId` sem declará-lo — isso só compila se ele ficar ANINHADO dentro do `describe("eventRepository", ...)` já existente no arquivo (o mesmo que já declara `let organizerAId: string;` no topo, reaproveitado pelo `describe("updateEvent", ...)` da Fase 3). Adicione este bloco como mais um `describe` filho, no mesmo nível de `describe("updateEvent", ...)`, não como um `describe` novo no nível do arquivo:

```ts
describe("findEventById and findEventBySlug", () => {
  beforeEach(async () => {
    await resetDatabase();
    const organizer = await testPrisma.organizer.create({
      data: { name: "Organizador Teste", email: "org@teste.dev" },
    });
    organizerAId = organizer.id;
  });

  it("findEventById returns the event regardless of organizer", async () => {
    const event = await createEvent(organizerAId, {
      name: "Evento Público",
      slug: "evento-publico-1",
      location: "São Paulo, SP",
      startsAt: new Date("2026-11-01T20:00:00-03:00"),
      ticketPriceCents: 5000,
      capacity: 100,
    });

    const found = await findEventById(event.id);

    expect(found?.id).toBe(event.id);
  });

  it("findEventById returns null for a nonexistent id", async () => {
    const found = await findEventById(crypto.randomUUID());

    expect(found).toBeNull();
  });

  it("findEventBySlug returns the event by its unique slug", async () => {
    await createEvent(organizerAId, {
      name: "Evento Público",
      slug: "evento-publico-2",
      location: "São Paulo, SP",
      startsAt: new Date("2026-11-01T20:00:00-03:00"),
      ticketPriceCents: 5000,
      capacity: 100,
    });

    const found = await findEventBySlug("evento-publico-2");

    expect(found?.slug).toBe("evento-publico-2");
  });

  it("findEventBySlug returns null for a nonexistent slug", async () => {
    const found = await findEventBySlug("nao-existe");

    expect(found).toBeNull();
  });
});
```

Add `findEventById`, `findEventBySlug` to the existing import line from `./eventRepository` at the top of the test file.

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- eventRepository`
Expected: FAIL — `findEventById`/`findEventBySlug` não existem.

- [ ] **Step 3: Implementar em `src/lib/db/eventRepository.ts`**

Append at the end of the file, after `updateEvent`:

```ts
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
  return prisma.event.findUnique({ where: { slug } });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- eventRepository`
Expected: PASS — todos os testes do arquivo (existentes + 4 novos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/eventRepository.ts src/lib/db/eventRepository.test.ts
git commit -m "feat: add system/public event lookups (findEventById, findEventBySlug)"
```

---

### Task 4: Cliente Mercado Pago (preference, pagamento, assinatura de webhook)

**Files:**
- Create: `src/lib/payments/mercadoPago.ts`
- Create: `src/lib/payments/verifyWebhookSignature.ts`
- Test: `src/lib/payments/mercadoPago.test.ts`
- Test: `src/lib/payments/verifyWebhookSignature.test.ts`

**Interfaces:**
- Produces: `createCheckoutPreference(params): Promise<{ id: string; initPoint: string }>`; `fetchPayment(paymentId: string): Promise<{ status: string; external_reference?: string }>`; `verifyMercadoPagoSignature(params): boolean` — usados pelo checkout (Task 7) e webhook (Task 8).

**Pré-requisito (ação manual sua):** crie uma aplicação de teste em https://www.mercadopago.com.br/developers, copie o `Access Token` de teste para `.env` como `MERCADO_PAGO_ACCESS_TOKEN="..."`, e configure um webhook secret na aplicação, copiando para `.env` como `MERCADO_PAGO_WEBHOOK_SECRET="..."`. Os testes desta task não fazem chamada real à API (o SDK é mockado), então não bloqueiam se as credenciais ainda não existirem — mas serão necessárias na Task 7/8 para o roteiro de verificação manual.

- [ ] **Step 1: Instalar o SDK do Mercado Pago**

Run: `npm install mercadopago`
Expected: instala sem erros.

- [ ] **Step 2: Escrever os testes que falham primeiro — assinatura (função pura, sem mock)**

Create `src/lib/payments/verifyWebhookSignature.test.ts`:

```ts
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMercadoPagoSignature } from "./verifyWebhookSignature";

const webhookSecret = "test-secret";

function buildSignature(
  dataId: string,
  requestId: string,
  ts: string,
  secret: string,
) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${hash}`;
}

describe("verifyMercadoPagoSignature", () => {
  it("accepts a correctly signed notification", () => {
    const xSignature = buildSignature("123", "req-1", "1700000000", webhookSecret);

    const result = verifyMercadoPagoSignature({
      xSignature,
      xRequestId: "req-1",
      dataId: "123",
      webhookSecret,
    });

    expect(result).toBe(true);
  });

  it("rejects a signature signed with the wrong secret", () => {
    const xSignature = buildSignature(
      "123",
      "req-1",
      "1700000000",
      "wrong-secret",
    );

    const result = verifyMercadoPagoSignature({
      xSignature,
      xRequestId: "req-1",
      dataId: "123",
      webhookSecret,
    });

    expect(result).toBe(false);
  });

  it("rejects when the dataId does not match what was signed", () => {
    const xSignature = buildSignature("123", "req-1", "1700000000", webhookSecret);

    const result = verifyMercadoPagoSignature({
      xSignature,
      xRequestId: "req-1",
      dataId: "999",
      webhookSecret,
    });

    expect(result).toBe(false);
  });

  it("rejects a malformed x-signature header", () => {
    const result = verifyMercadoPagoSignature({
      xSignature: "not-a-valid-header",
      xRequestId: "req-1",
      dataId: "123",
      webhookSecret,
    });

    expect(result).toBe(false);
  });
});
```

Also create an empty `src/lib/payments/verifyWebhookSignature.ts` (no exports yet).

- [ ] **Step 3: Rodar e confirmar RED**

Run: `npm test -- verifyWebhookSignature`
Expected: FAIL — `verifyMercadoPagoSignature` não existe.

- [ ] **Step 4: Implementar `src/lib/payments/verifyWebhookSignature.ts`**

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMercadoPagoSignature(params: {
  xSignature: string;
  xRequestId: string;
  dataId: string;
  webhookSecret: string;
}): boolean {
  const { xSignature, xRequestId, dataId, webhookSecret } = params;

  const signatureParts = Object.fromEntries(
    xSignature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );

  const timestamp = signatureParts.ts;
  const receivedHash = signatureParts.v1;
  if (!timestamp || !receivedHash) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${timestamp};`;
  const expectedHash = createHmac("sha256", webhookSecret)
    .update(manifest)
    .digest("hex");

  if (receivedHash.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(receivedHash), Buffer.from(expectedHash));
}
```

- [ ] **Step 5: Rodar e confirmar GREEN**

Run: `npm test -- verifyWebhookSignature`
Expected: PASS — 4 testes.

- [ ] **Step 6: Escrever os testes que falham primeiro — cliente Mercado Pago (SDK mockado)**

Create `src/lib/payments/mercadoPago.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const preferenceCreateMock = vi.fn();
const paymentGetMock = vi.fn();

vi.mock("mercadopago", () => ({
  MercadoPagoConfig: vi.fn().mockImplementation(() => ({})),
  Preference: vi.fn().mockImplementation(() => ({
    create: preferenceCreateMock,
  })),
  Payment: vi.fn().mockImplementation(() => ({
    get: paymentGetMock,
  })),
}));

const { createCheckoutPreference, fetchPayment } = await import(
  "./mercadoPago"
);

describe("createCheckoutPreference", () => {
  beforeEach(() => {
    preferenceCreateMock.mockReset();
  });

  it("builds a preference from the event price and quantity, in reais", async () => {
    preferenceCreateMock.mockResolvedValue({
      id: "pref_123",
      init_point: "https://mp.test/checkout/pref_123",
    });

    const result = await createCheckoutPreference({
      orderId: "order_1",
      eventName: "Show de Teste",
      ticketPriceCents: 5000,
      quantity: 2,
      notificationUrl: "https://app.test/api/webhooks/mercadopago",
    });

    expect(result.initPoint).toBe("https://mp.test/checkout/pref_123");
    const callArgs = preferenceCreateMock.mock.calls[0][0];
    expect(callArgs.body.items[0].unit_price).toBe(50);
    expect(callArgs.body.items[0].quantity).toBe(2);
    expect(callArgs.body.external_reference).toBe("order_1");
    expect(callArgs.body.notification_url).toBe(
      "https://app.test/api/webhooks/mercadopago",
    );
  });
});

describe("fetchPayment", () => {
  it("fetches payment details by id", async () => {
    paymentGetMock.mockResolvedValue({ id: 123, status: "approved" });

    const payment = await fetchPayment("123");

    expect(payment.status).toBe("approved");
    expect(paymentGetMock).toHaveBeenCalledWith({ id: "123" });
  });
});
```

Also create an empty `src/lib/payments/mercadoPago.ts` (no exports yet).

- [ ] **Step 7: Rodar e confirmar RED**

Run: `npm test -- mercadoPago`
Expected: FAIL — `createCheckoutPreference`/`fetchPayment` não existem.

- [ ] **Step 8: Implementar `src/lib/payments/mercadoPago.ts`**

```ts
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "",
});

export async function createCheckoutPreference(params: {
  orderId: string;
  eventName: string;
  ticketPriceCents: number;
  quantity: number;
  notificationUrl: string;
}) {
  const preference = new Preference(client);
  const result = await preference.create({
    body: {
      items: [
        {
          id: params.orderId,
          title: params.eventName,
          quantity: params.quantity,
          unit_price: params.ticketPriceCents / 100,
          currency_id: "BRL",
        },
      ],
      external_reference: params.orderId,
      notification_url: params.notificationUrl,
    },
  });

  return { id: result.id, initPoint: result.init_point };
}

export async function fetchPayment(paymentId: string) {
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}
```

- [ ] **Step 9: Rodar e confirmar GREEN**

Run: `npm test -- mercadoPago`
Expected: PASS — 2 testes.

- [ ] **Step 10: Rodar a suíte completa**

Run: `npm test`
Expected: PASS — todos os testes.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json src/lib/payments
git commit -m "feat: add Mercado Pago client and webhook signature verification"
```

---

### Task 5: Envio de e-mail com o ingresso (Resend)

**Files:**
- Create: `src/lib/email/TicketEmail.tsx`
- Create: `src/lib/email/sendTicketEmail.tsx`
- Test: `src/lib/email/sendTicketEmail.test.tsx`

**Interfaces:**
- Produces: `sendTicketEmail(params): Promise<void>` — usado pelo webhook (Task 8).

**Pré-requisito (ação manual sua):** crie uma conta em https://resend.com, gere uma API Key, coloque em `.env` como `RESEND_API_KEY="..."`. Os testes desta task mockam o SDK, não fazem chamada real.

- [ ] **Step 1: Instalar o Resend**

Run: `npm install resend`
Expected: instala sem erros.

- [ ] **Step 2: Criar `src/lib/email/TicketEmail.tsx`**

```tsx
type TicketEmailProps = {
  buyerName: string;
  eventName: string;
  eventLocation: string;
  eventStartsAt: Date;
  qrCodeDataUrl: string;
};

export function TicketEmail({
  buyerName,
  eventName,
  eventLocation,
  eventStartsAt,
  qrCodeDataUrl,
}: TicketEmailProps) {
  const formattedDate = eventStartsAt.toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <div style={{ fontFamily: "sans-serif", padding: "24px" }}>
      <h1>Seu ingresso para {eventName}</h1>
      <p>Olá, {buyerName}!</p>
      <p>
        {eventLocation} — {formattedDate}
      </p>
      <img
        src={qrCodeDataUrl}
        alt="QR Code do ingresso"
        width={240}
        height={240}
      />
      <p>Apresente este QR Code na entrada do evento.</p>
    </div>
  );
}
```

- [ ] **Step 3: Escrever o teste que falha primeiro**

Create `src/lib/email/sendTicketEmail.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn().mockResolvedValue({ data: { id: "email_123" }, error: null });

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

const { sendTicketEmail } = await import("./sendTicketEmail");

describe("sendTicketEmail", () => {
  beforeEach(() => {
    sendMock.mockClear();
  });

  it("sends the ticket email to the buyer with the event details", async () => {
    await sendTicketEmail({
      buyerEmail: "comprador@teste.dev",
      buyerName: "Comprador Teste",
      eventName: "Show de Teste",
      eventLocation: "São Paulo, SP",
      eventStartsAt: new Date("2026-12-01T23:00:00.000Z"),
      qrCodeDataUrl: "data:image/png;base64,AAAA",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const callArgs = sendMock.mock.calls[0][0];
    expect(callArgs.to).toBe("comprador@teste.dev");
    expect(callArgs.subject).toContain("Show de Teste");
  });
});
```

Also create an empty `src/lib/email/sendTicketEmail.tsx` (no exports yet).

- [ ] **Step 4: Rodar e confirmar RED**

Run: `npm test -- sendTicketEmail`
Expected: FAIL — `sendTicketEmail` não existe.

- [ ] **Step 5: Implementar `src/lib/email/sendTicketEmail.tsx`**

```tsx
import { Resend } from "resend";
import { TicketEmail } from "./TicketEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendTicketEmail(params: {
  buyerEmail: string;
  buyerName: string;
  eventName: string;
  eventLocation: string;
  eventStartsAt: Date;
  qrCodeDataUrl: string;
}) {
  await resend.emails.send({
    from: "Plataforma de Ingressos <ingressos@resend.dev>",
    to: params.buyerEmail,
    subject: `Seu ingresso para ${params.eventName}`,
    react: (
      <TicketEmail
        buyerName={params.buyerName}
        eventName={params.eventName}
        eventLocation={params.eventLocation}
        eventStartsAt={params.eventStartsAt}
        qrCodeDataUrl={params.qrCodeDataUrl}
      />
    ),
  });
}
```

- [ ] **Step 6: Rodar e confirmar GREEN**

Run: `npm test -- sendTicketEmail`
Expected: PASS — 1 teste.

- [ ] **Step 7: Rodar a suíte completa**

Run: `npm test`
Expected: PASS — todos os testes.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/lib/email
git commit -m "feat: add ticket email sending via Resend"
```

---

### Task 6: Página pública do evento (`/e/[slug]`)

**Files:**
- Create: `src/app/e/[slug]/page.tsx`

**Interfaces:**
- Consumes: `findEventBySlug` de `src/lib/db/eventRepository.ts` (Task 3).

- [ ] **Step 1: Criar `src/app/e/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { findEventBySlug } from "@/lib/db/eventRepository";

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
    <main className="mx-auto max-w-md p-8">
      {status === "success" && (
        <p className="mb-4 text-sm text-green-500">
          Pagamento em processamento! Você receberá o ingresso por e-mail
          assim que for confirmado.
        </p>
      )}
      {status === "failure" && (
        <p className="mb-4 text-sm text-red-500">
          Pagamento não foi concluído. Tente novamente.
        </p>
      )}
      <h1 className="text-2xl font-semibold">{event.name}</h1>
      <p className="text-gray-400">{event.location}</p>
      <p className="text-gray-400">{formattedDate}</p>
      {event.description && <p className="mt-4">{event.description}</p>}
      <p className="mt-4 text-lg font-semibold">
        R$ {(event.ticketPriceCents / 100).toFixed(2)}
      </p>
      <form
        action="/api/checkout"
        method="POST"
        className="mt-6 flex flex-col gap-4"
      >
        <input type="hidden" name="eventId" value={event.id} />
        <input
          name="buyerName"
          placeholder="Seu nome"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="buyerEmail"
          type="email"
          placeholder="Seu e-mail"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="quantity"
          type="number"
          min="1"
          max="10"
          defaultValue={1}
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-2 text-white"
        >
          Comprar ingresso
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Verificar que o projeto compila**

Run: `npm run build`
Expected: build conclui com sucesso; `/e/[slug]` aparece na listagem de rotas.

- [ ] **Step 3: Commit**

```bash
git add "src/app/e/[slug]"
git commit -m "feat: add public event sales page"
```

---

### Task 7: Rota de checkout (`/api/checkout`)

**Files:**
- Create: `src/app/api/checkout/route.ts`

**Interfaces:**
- Consumes: `findEventById` de `src/lib/db/eventRepository.ts` (Task 3); `createOrder` de `src/lib/db/orderRepository.ts` (Task 2); `createCheckoutPreference` de `src/lib/payments/mercadoPago.ts` (Task 4).

- [ ] **Step 1: Criar `src/app/api/checkout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { findEventById } from "@/lib/db/eventRepository";
import { createOrder } from "@/lib/db/orderRepository";
import { createCheckoutPreference } from "@/lib/payments/mercadoPago";

const checkoutSchema = z.object({
  eventId: z.string().uuid(),
  buyerName: z.string().trim().min(1),
  buyerEmail: z.string().email(),
  quantity: z.coerce.number().int().min(1).max(10),
});

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = checkoutSchema.safeParse({
    eventId: formData.get("eventId"),
    buyerName: formData.get("buyerName"),
    buyerEmail: formData.get("buyerEmail"),
    quantity: formData.get("quantity"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const { eventId, buyerName, buyerEmail, quantity } = parsed.data;

  const event = await findEventById(eventId);
  if (!event || event.status !== "PUBLISHED") {
    return NextResponse.json({ error: "event not available" }, { status: 404 });
  }

  // Preço sempre recalculado a partir do registro do evento — nunca
  // aceito como campo de formulário, para não permitir manipulação de valor.
  const totalAmountCents = event.ticketPriceCents * quantity;

  const order = await createOrder({
    eventId: event.id,
    organizerId: event.organizerId,
    buyerName,
    buyerEmail,
    quantity,
    totalAmountCents,
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const preference = await createCheckoutPreference({
    orderId: order.id,
    eventName: event.name,
    ticketPriceCents: event.ticketPriceCents,
    quantity,
    notificationUrl: `${appUrl}/api/webhooks/mercadopago`,
  });

  return NextResponse.redirect(preference.initPoint, { status: 303 });
}
```

- [ ] **Step 2: Verificar que o projeto compila**

Run: `npm run build`
Expected: build conclui com sucesso; `/api/checkout` aparece na listagem de rotas.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/checkout
git commit -m "feat: add checkout route with server-side price calculation"
```

---

### Task 8: Webhook do Mercado Pago (`/api/webhooks/mercadopago`)

**Files:**
- Create: `src/app/api/webhooks/mercadopago/route.ts`
- Test: `src/app/api/webhooks/mercadopago/route.test.ts`

**Interfaces:**
- Consumes: `verifyMercadoPagoSignature`, `fetchPayment` (Task 4); `markOrderAsPaidAndCreateTickets`, `findOrderById` (Task 2); `findEventById` (Task 3); `generateQrCodeDataUrl` (Task 1); `sendTicketEmail` (Task 5).

- [ ] **Step 1: Escrever os testes que falham primeiro**

Create `src/app/api/webhooks/mercadopago/route.test.ts`:

```ts
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDatabase, testPrisma } from "../../../../../tests/testDb";

const fetchPaymentMock = vi.fn();
vi.mock("@/lib/payments/mercadoPago", () => ({
  fetchPayment: fetchPaymentMock,
}));

const sendTicketEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email/sendTicketEmail", () => ({
  sendTicketEmail: sendTicketEmailMock,
}));

const webhookSecret = "test-webhook-secret";
process.env.MERCADO_PAGO_WEBHOOK_SECRET = webhookSecret;

const { POST } = await import("./route");

function buildSignedRequest(dataId: string, requestId: string) {
  const ts = "1700000000";
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = createHmac("sha256", webhookSecret).update(manifest).digest("hex");

  return new Request("http://localhost/api/webhooks/mercadopago", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature": `ts=${ts},v1=${hash}`,
      "x-request-id": requestId,
    },
    body: JSON.stringify({ data: { id: dataId } }),
  });
}

describe("POST /api/webhooks/mercadopago", () => {
  let organizerId: string;
  let eventId: string;
  let orderId: string;

  beforeEach(async () => {
    await resetDatabase();
    fetchPaymentMock.mockReset();
    sendTicketEmailMock.mockClear();

    const organizer = await testPrisma.organizer.create({
      data: { name: "Organizador Teste", email: "org@teste.dev" },
    });
    organizerId = organizer.id;
    const event = await testPrisma.event.create({
      data: {
        organizerId,
        name: "Show de Teste",
        slug: "show-webhook-teste",
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
        status: "PENDING",
      },
    });
    orderId = order.id;
  });

  it("rejects a request with an invalid signature", async () => {
    const request = new Request("http://localhost/api/webhooks/mercadopago", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature": "ts=123,v1=deadbeef",
        "x-request-id": "req-1",
      },
      body: JSON.stringify({ data: { id: "payment-1" } }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(fetchPaymentMock).not.toHaveBeenCalled();
  });

  it("marks the order as paid and sends the ticket email on an approved payment", async () => {
    fetchPaymentMock.mockResolvedValue({
      status: "approved",
      external_reference: orderId,
    });

    const request = buildSignedRequest("payment-1", "req-1");
    const response = await POST(request);

    expect(response.status).toBe(200);

    const updatedOrder = await testPrisma.order.findUnique({
      where: { id: orderId },
    });
    expect(updatedOrder?.status).toBe("PAID");

    const tickets = await testPrisma.ticket.findMany({ where: { orderId } });
    expect(tickets).toHaveLength(1);

    expect(sendTicketEmailMock).toHaveBeenCalledTimes(1);
    expect(sendTicketEmailMock.mock.calls[0][0].buyerEmail).toBe(
      "comprador@teste.dev",
    );
  });

  it("is idempotent: the same notification processed twice does not resend the email", async () => {
    fetchPaymentMock.mockResolvedValue({
      status: "approved",
      external_reference: orderId,
    });

    await POST(buildSignedRequest("payment-1", "req-1"));
    await POST(buildSignedRequest("payment-1", "req-2"));

    const tickets = await testPrisma.ticket.findMany({ where: { orderId } });
    expect(tickets).toHaveLength(1);
    expect(sendTicketEmailMock).toHaveBeenCalledTimes(1);
  });

  it("does not create tickets when the payment is not approved", async () => {
    fetchPaymentMock.mockResolvedValue({
      status: "pending",
      external_reference: orderId,
    });

    const request = buildSignedRequest("payment-1", "req-1");
    const response = await POST(request);

    expect(response.status).toBe(200);
    const tickets = await testPrisma.ticket.findMany({ where: { orderId } });
    expect(tickets).toHaveLength(0);
    expect(sendTicketEmailMock).not.toHaveBeenCalled();
  });
});
```

Also create an empty `src/app/api/webhooks/mercadopago/route.ts` exporting an empty `POST` (no real logic yet).

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- route.test.ts`
Expected: FAIL — a rota ainda não implementa a lógica.

- [ ] **Step 3: Implementar `src/app/api/webhooks/mercadopago/route.ts`**

```ts
import { NextResponse } from "next/server";
import { findEventById } from "@/lib/db/eventRepository";
import { markOrderAsPaidAndCreateTickets } from "@/lib/db/orderRepository";
import { sendTicketEmail } from "@/lib/email/sendTicketEmail";
import { fetchPayment } from "@/lib/payments/mercadoPago";
import { verifyMercadoPagoSignature } from "@/lib/payments/verifyWebhookSignature";
import { generateQrCodeDataUrl } from "@/lib/tickets/qrCode";

export async function POST(request: Request) {
  const xSignature = request.headers.get("x-signature") ?? "";
  const xRequestId = request.headers.get("x-request-id") ?? "";
  const body = await request.json();

  const dataId = body?.data?.id;
  if (!dataId) {
    return NextResponse.json({ error: "missing data.id" }, { status: 400 });
  }

  const signatureValid = verifyMercadoPagoSignature({
    xSignature,
    xRequestId,
    dataId: String(dataId),
    webhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "",
  });

  if (!signatureValid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const payment = await fetchPayment(String(dataId));

  if (payment.status !== "approved") {
    return NextResponse.json({ received: true });
  }

  const orderId = payment.external_reference;
  if (!orderId) {
    return NextResponse.json(
      { error: "missing external_reference" },
      { status: 400 },
    );
  }

  const result = await markOrderAsPaidAndCreateTickets({
    orderId,
    mercadoPagoPaymentId: String(dataId),
  });

  if (!result.alreadyProcessed) {
    const event = await findEventById(result.order.eventId);
    if (event) {
      for (const ticket of result.tickets) {
        const qrCodeDataUrl = await generateQrCodeDataUrl(ticket.qrToken);
        await sendTicketEmail({
          buyerEmail: result.order.buyerEmail,
          buyerName: ticket.buyerName,
          eventName: event.name,
          eventLocation: event.location,
          eventStartsAt: event.startsAt,
          qrCodeDataUrl,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- route.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 5: Rodar a suíte completa**

Run: `npm test`
Expected: PASS — todos os testes.

- [ ] **Step 6: Verificar que o projeto compila**

Run: `npm run build`
Expected: build conclui com sucesso.

- [ ] **Step 7: Roteiro de verificação manual (controlador, parcial — sem conta Mercado Pago real ainda)**

Run: `npm run dev`, depois:
1. Publique um evento (via `/admin/events`, editar status para `PUBLISHED`).
2. Acesse `/e/[slug]` do evento publicado — deve mostrar os dados corretos e o formulário de compra.
3. Preencha o formulário e envie. **Se `MERCADO_PAGO_ACCESS_TOKEN` ainda não estiver configurado**, a chamada a `createCheckoutPreference` vai falhar — isso é esperado nesta verificação parcial; confirme que um `Order` com `status: PENDING` foi criado no banco antes da falha (via `npx prisma studio` ou uma query direta), provando que o cálculo de preço e a criação do pedido funcionam. **Se as credenciais já estiverem configuradas**, o navegador deve ser redirecionado para uma URL real do Mercado Pago (`mercadopago.com`).
4. Tente acessar `/e/algum-slug-que-nao-existe` — deve dar 404.
5. Tente acessar `/e/[slug]` de um evento com status `DRAFT` — deve dar 404 (não deve ser possível comprar evento não publicado).

- [ ] **Step 8: Commit**

```bash
git add src/app/api/webhooks
git commit -m "feat: add Mercado Pago webhook with signature verification and idempotent processing"
```

---

## Fim da Fase 4

Ao concluir: um comprador consegue ver um evento publicado, comprar (com preço sempre calculado no servidor), e — assim que o Mercado Pago confirmar o pagamento via webhook verificado e idempotente — recebe um QR Code único por e-mail. Toda a lógica crítica (assinatura, idempotência, cálculo de preço, criação de tickets) está coberta por testes automatizados contra banco real ou com os SDKs externos mockados. O round-trip completo com o Mercado Pago real só é testável com credenciais de sandbox configuradas e, para o webhook, com o app publicamente acessível — registrar isso como pré-requisito de teste de aceitação antes de considerar esta fase pronta para produção. Próxima fase: **Fase 5 — Scanner de portaria + validação atômica** (o `TicketStatus`/`CheckInAttempt` já existem no schema desde a Fase 1; a rota de validação segue o mesmo padrão de UPDATE atômico condicional já usado em `updateEvent` e `markOrderAsPaidAndCreateTickets`).
