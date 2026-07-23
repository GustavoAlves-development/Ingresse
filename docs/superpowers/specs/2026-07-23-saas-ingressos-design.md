# SaaS de Venda de Ingressos e Controle de Portaria — Design

**Data:** 2026-07-23
**Status:** Aprovado para planejamento de implementação

## 1. Contexto e Objetivo

Construir um SaaS multi-tenant onde organizadores de eventos podem:

1. Criar e gerenciar eventos (painel do organizador).
2. Vender ingressos através de uma página pública exclusiva por evento.
3. Ter o ingresso (QR Code único) gerado e enviado por e-mail automaticamente após confirmação de pagamento via webhook.
4. Validar ingressos na portaria através de um scanner de QR Code usando a câmera do celular, com proteção contra reuso (fraude) mesmo sob leituras concorrentes.

Convenção de nomenclatura obrigatória em todo o projeto: **camelCase** para variáveis, funções, rotas e colunas de banco de dados.

## 2. Decisões de Escopo (definidas em brainstorming)

| Decisão | Escolha |
|---|---|
| Gateway de pagamento | Mercado Pago (PIX nativo, mercado brasileiro) |
| Modelo de tenancy | Multi-tenant — múltiplos organizadores independentes |
| Stack | Next.js (App Router) full-stack, TypeScript |
| Banco de dados | Postgres via Neon (serverless, pooling nativo para Vercel) |
| ORM | Prisma |
| E-mail transacional | Resend + React Email |
| Autenticação | Auth.js (NextAuth), credenciais + RBAC por `role` |
| Isolamento multi-tenant | Row-level via coluna `organizerId` em todas as tabelas relevantes (não schema-per-tenant) |
| Concorrência na validação de QR | UPDATE atômico condicional (`UPDATE ... WHERE status = 'VALID' RETURNING *`), sem lock explícito nem infra externa (Redis) |
| Deploy | Vercel (app) + Neon (banco) |

### Alternativas consideradas e descartadas

- **Schema por tenant:** isolamento mais forte, mas migração multiplicada por N schemas sem necessidade real no volume esperado. Descartado a favor de row-level.
- **`SELECT ... FOR UPDATE` + transação explícita** para validação de QR: mais código e superfície de erro (transação presa) sem ganho sobre o UPDATE atômico condicional. Descartado.
- **Lock distribuído via Redis** para validação de QR: only se justificaria com múltiplos serviços não-transacionais; aqui o Postgres já resolve sozinho. Descartado.
- **Stripe** como gateway: melhor para mercado internacional, mas sem PIX nativo — método de pagamento dominante para ingressos no Brasil. Descartado.

## 3. Arquitetura

```
Next.js 14+ (App Router, TypeScript) — projeto único
├─ /app/(admin)                     → Painel do Organizador (autenticado)
├─ /app/e/[eventSlug]                → Página pública de vendas (SSR, sem auth)
├─ /app/portaria/[eventId]           → Scanner de QR (autenticado, role portariaStaff)
├─ /app/api/checkout                 → cria preferência de pagamento no Mercado Pago
├─ /app/api/webhooks/mercadopago     → recebe confirmação de pagamento
└─ /app/api/tickets/validate         → valida QR na portaria (rota crítica)

Prisma ORM → Neon Postgres
Auth.js (NextAuth) → sessão + RBAC (organizerAdmin / portariaStaff)
Mercado Pago SDK → checkout + webhook
Resend + React Email → envio do ingresso com QR
qrcode + nanoid → geração da imagem do QR e do token opaco
Deploy: Vercel (app) + Neon (banco)
```

Justificativa: um único projeto Next.js full-stack evita a complexidade de manter duas bases de código (frontend + backend separados) sem ganho de escala no volume esperado atualmente. SSR na página pública de vendas favorece compartilhamento/SEO do link do evento.

## 4. Modelo de Dados

Multi-tenant via `organizerId` em cada tabela relevante. Modelos em PascalCase (padrão Prisma), todas as colunas em camelCase.

> **Nota técnica:** Prisma sempre usa identificadores entre aspas no SQL gerado, então colunas camelCase no Postgres são preservadas corretamente — isso só é garantido enquanto todo acesso ao banco passar pelo Prisma (nunca escrever SQL cru sem aspas nos nomes das colunas).

```prisma
model Organizer {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  document  String?  // CNPJ/CPF
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
  slug             String      @unique // usado na URL pública /e/[slug]
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
  organizerId             String // denormalizado de Event, evita join para filtrar por tenant
  eventId                 String
  buyerName               String
  buyerEmail              String
  quantity                Int
  totalAmountCents        Int
  status                  OrderStatus @default(PENDING)
  mercadoPagoPaymentId    String?     @unique // garante idempotência do webhook
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
  organizerId  String // denormalizado de Event, evita join para filtrar por tenant
  eventId      String
  orderId      String
  qrToken      String       @unique // token opaco (nanoid), nunca o id interno
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

// log de auditoria: toda tentativa de leitura, inclusive as que falham —
// evidência em caso de disputa de fraude e contexto para o alerta na portaria
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

Relacionamentos: `Organizer` 1–N `User`; `Organizer` 1–N `Event`; `Event` 1–N `Order`; `Order` 1–N `Ticket` (um `Ticket` por unidade comprada, cada um com `qrToken` próprio); `Ticket` 1–N `CheckInAttempt`.

Por que `qrToken` é um campo separado do `id`: o QR Code nunca deve carregar o identificador interno do registro (evita enumeration). `qrToken` é gerado com `nanoid(32)` — aleatoriedade suficiente para tornar adivinhação inviável, sem necessidade de assinatura HMAC adicional já que toda validação passa pelo banco (não há verificação offline do QR).

Escopo assumido: cada evento tem um único tipo/preço de ingresso (`ticketPriceCents` em `Event`). Múltiplos lotes/tipos de ingresso por evento ficam fora do escopo desta spec.

## 5. Fluxo de Pagamento → Geração do Ingresso

1. Comprador finaliza checkout na página pública do evento → API cria `Order` (`status = PENDING`) e uma *preference* no Mercado Pago → redireciona para o checkout do Mercado Pago.
2. Mercado Pago envia notificação para `/api/webhooks/mercadopago`.
3. O webhook **não confia no corpo da notificação**: usa apenas o `paymentId` recebido para buscar o pagamento de volta na API do Mercado Pago (fonte da verdade) e confirma o status, além de validar a assinatura `x-signature` conforme a documentação do Mercado Pago.
4. Se o pagamento estiver aprovado: dentro de uma transação, atualiza `Order.status = PAID` e cria N registros `Ticket` (um por unidade comprada).
5. **Idempotência:** a constraint `@unique` em `mercadoPagoPaymentId` garante que reenvios da notificação (comportamento comum do Mercado Pago) não dupliquem ingressos.
6. Gera a imagem do QR (lib `qrcode`) a partir de cada `qrToken` e envia por e-mail via Resend — um QR por ingresso.

## 6. Validação na Portaria — núcleo de segurança

Estratégia de concorrência: um único `UPDATE` condicional faz o check-and-set atomicamente. O Postgres serializa a operação via row lock implícito do próprio `UPDATE` — sem `SELECT ... FOR UPDATE`, sem lock explícito, sem infraestrutura externa.

```ts
// uma única instrução SQL faz o check-and-set atomicamente.
const [updatedTicket] = await prisma.$queryRaw<Ticket[]>`
  UPDATE "Ticket"
  SET "status" = 'USED', "usedAt" = now(), "usedByUserId" = ${staffUserId}
  WHERE "qrToken" = ${qrToken} AND "status" = 'VALID'
  RETURNING *
`;

if (updatedTicket) {
  // sucesso: apenas uma leitura concorrente pode chegar aqui
  await logCheckInAttempt(updatedTicket.id, staffUserId, 'SUCCESS');
  return { result: 'success', ticket: updatedTicket };
}

// updatedTicket vazio: token não existe OU já foi usado.
// esta leitura extra serve só para a mensagem — o UPDATE atômico acima
// já decidiu o resultado real, então não há race condition aqui.
const existing = await prisma.ticket.findUnique({ where: { qrToken } });
const result = existing ? 'ALREADY_USED' : 'INVALID';
if (existing) await logCheckInAttempt(existing.id, staffUserId, result);
return { result: result.toLowerCase(), ticket: existing };
```

Se dois scanners lerem o mesmo QR Code no mesmo instante, o Postgres garante que só um `UPDATE` afeta a linha — o segundo não encontra `status = 'VALID'` e cai no ramo `ALREADY_USED`, disparando o alerta visual/sonoro no scanner.

Autorização: a rota valida via sessão do Auth.js que o usuário tem role `PORTARIA_STAFF` (ou `ORGANIZER_ADMIN`) **e** que `ticket.organizerId` é igual ao `organizerId` do usuário logado — comparação direta, sem precisar de join até `Event`, o que impede que staff de um organizador valide ingresso de outro.

## 7. UI / Tema

- Fundo base bem escuro (`#0a0a0f`), cards em cinza-chumbo (`#16161f`) com borda sutil de 1px.
- Header num tom de cinza mais claro que o body (`#1c1c26`) com glow sutil azul (box-shadow difuso, baixa opacidade) atrás da logo — cria profundidade sem competir com o azul escuro da marca.
- Cor de destaque (CTAs, botões primários) num azul mais vibrante/claro que o da logo, para ter contraste próprio.
- Alertas do scanner: verde vibrante com glow para sucesso; vermelho vibrante com glow + ícone pulsante para "ingresso já utilizado" — reforça a leitura à distância na portaria.
- Base técnica: Tailwind CSS + shadcn/ui, tema via CSS variables.

## 8. Segurança e Autenticação

- Auth.js (NextAuth) com provider de credenciais (e-mail/senha) para organizadores e staff.
- RBAC via campo `role` (`ORGANIZER_ADMIN`, `PORTARIA_STAFF`).
- Toda rota de API valida sessão e checa pertencimento ao `organizerId` do recurso acessado antes de ler/escrever dados (isolamento multi-tenant).
- Webhook do Mercado Pago: validação de assinatura + re-busca do pagamento na API oficial antes de confiar em qualquer dado recebido.
- Validação de input com Zod em todas as rotas de API.
- `qrToken` gerado com `nanoid(32)` — aleatoriedade criptográfica, não sequencial.

## 9. Testes

- **Vitest** para lógica de negócio, com foco especial em um teste que dispara duas chamadas concorrentes de validação para o mesmo `qrToken` e garante que apenas uma retorna `success`.
- **Playwright** para os fluxos críticos ponta a ponta: checkout completo, geração e envio do e-mail (mock do Resend), leitura do QR na portaria (sucesso e reuso).

## 10. Fora de Escopo (nesta primeira versão)

- Múltiplos tipos/lotes de ingresso por evento.
- Reembolsos automatizados via API do Mercado Pago (fluxo manual por enquanto).
- App mobile nativo — o scanner de portaria é uma página web usando a câmera do navegador (`getUserMedia`).
- Analytics/dashboard consolidado entre organizadores (métricas ficam escopadas por `organizerId`).
