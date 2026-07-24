# Página Pública do Evento — Capa, Atrações e Confirmados — Design

**Data:** 2026-07-24
**Status:** Aprovado para planejamento de implementação

## 1. Contexto e Objetivo

A página pública de vendas (`/e/[slug]`) hoje é um card genérico: nome, local, data, descrição, preço, formulário. Não usa nenhuma imagem (embora `Event.coverImageUrl` já exista no schema, sem uso na UI), não mostra quem vai tocar/se apresentar no evento, e não passa nenhuma sensação de urgência/prova social. Objetivo desta feature: tornar essa página mais convidativa, dando ao organizador ferramentas para expor melhor o evento — uma capa, o line-up de atrações (DJs, cantores, bandas) e um número de pessoas já confirmadas — e exibindo tudo isso de forma atraente pro comprador final.

## 2. Decisões de Escopo (definidas em brainstorming)

| Decisão | Escolha |
|---|---|
| Imagem do evento | Uma capa só (usa o campo `coverImageUrl` já existente no schema), não galeria |
| Upload de imagem | Upload de arquivo real (não link colado), via Vercel Blob |
| Dados de cada atração | Nome + foto (foto opcional — sem foto cai num avatar com a inicial do nome) |
| "Pessoas confirmadas" | Número digitado manualmente pelo organizador (não é a contagem real de ingressos vendidos) |
| Onde se cadastra atração | Só na edição do evento (não na criação — precisa do evento já existir pra associar a foto) |

### Alternativas consideradas e descartadas

- **Galeria de várias fotos por evento:** mais rico visualmente, mas exige um modelo de dados novo (`EventImage`) e UI de upload múltiplo/reordenação — descartado a favor de uma capa só, que já resolve o pedido central ("mais convidativo") com bem menos superfície nova.
- **Contagem automática de confirmados** (a partir de `Ticket`s pagos): sempre correta e sem trabalho manual, mas o organizador optou por controlar o número manualmente (útil pra eventos com venda em outro canal, ou que preferem exibir um número diferente do real por marketing). Não há validação contra `capacity` — é um campo de marketing, não uma contagem de estoque.
- **UploadThing / Cloudinary** como serviço de imagem: ambos exigem uma conta/fornecedor novo sem vantagem sobre o Vercel Blob, que já é nativo da plataforma de deploy do projeto (spec original, seção 2).
- **Reordenar atrações manualmente (drag-and-drop):** fora de escopo — a ordem de exibição é a ordem de cadastro (`createdAt`).

## 3. Modelo de Dados

```prisma
model Event {
  // ...campos existentes sem alteração...
  coverImageUrl      String?   // já existe; passa a ser preenchido via upload na UI
  confirmedAttendees Int?      // novo: número manual, exibido só se preenchido

  attractions Attraction[]     // nova relação
}

model Attraction {
  id          String   @id @default(uuid())
  eventId     String
  organizerId String   // denormalizado de Event, evita join para filtrar por tenant
                        // (mesmo padrão de Order/Ticket)
  name        String
  photoUrl    String?
  createdAt   DateTime @default(now())

  event Event @relation(fields: [eventId], references: [id])

  @@index([eventId])
  @@index([organizerId])
}
```

`organizerId` denormalizado em `Attraction` segue o padrão canônico já estabelecido em `Order`/`Ticket`: toda escrita/leitura tenant-scoped exige `organizerId` **e** o id do recurso juntos na mesma query, sem depender de join até `Event`.

## 4. Upload de Imagem (capa do evento + foto de atração)

Upload direto do navegador para o Vercel Blob, sem passar o arquivo pelo servidor Next.js (padrão recomendado do Vercel — evita o limite de tamanho de payload de uma Server Action e o custo de function-time proporcional ao tamanho do arquivo):

1. Um componente client (`ImageUpload`) captura o arquivo escolhido e chama `upload()` do `@vercel/blob/client`, apontando para uma rota de autorização própria.
2. `POST /api/upload` implementa `handleUpload` do `@vercel/blob/client`: confirma que existe uma sessão autenticada (`session.user.organizerId`) antes de emitir o token de upload, restringe `allowedContentTypes` a `image/png`, `image/jpeg`, `image/webp` e limita o tamanho a 5MB.
3. Após o upload concluir, o componente recebe a URL pública do arquivo e a escreve num campo oculto (`<input type="hidden">`) dentro do formulário — o mesmo formulário (criar/editar evento, adicionar atração) que já existe, sem uma segunda etapa de submissão.

Pré-requisito externo (mesmo fluxo de contas já usado para Neon/Mercado Pago/Resend): criar um **Vercel Blob store** no dashboard do Vercel e obter o token `BLOB_READ_WRITE_TOKEN`, adicionado ao `.env`.

## 5. Painel do Organizador

- **`/admin/events/new`**: ganha dois campos novos — "Capa do evento" (`ImageUpload`, opcional) e "Pessoas confirmadas" (número inteiro não-negativo, opcional).
- **`/admin/events/[eventId]/edit`**: os mesmos dois campos, mais uma seção **"Atrações"**:
  - Lista as atrações já cadastradas (foto ou avatar com inicial + nome + botão "Remover").
  - Um miniformulário abaixo da lista para adicionar uma nova atração (nome + `ImageUpload` opcional + botão "Adicionar").
  - Adicionar e remover atração são ações independentes da atualização dos campos do evento (server actions próprias, `addAttractionAction`/`removeAttractionAction`), não fazem parte do submit principal do formulário de edição — evita um formulário gigante multi-propósito e permite adicionar várias atrações sem re-salvar o evento inteiro a cada uma.

## 6. Página Pública (`/e/[slug]`)

Layout atual (card único, texto simples) vira:

1. **Capa em destaque**, full-width, no topo — com um gradiente escurecendo a parte de baixo da imagem e o nome do evento sobreposto em destaque (fonte de heading, grande). Se o evento não tiver capa cadastrada, a página cai graciosamente no layout de card simples (sem espaço vazio/quebrado no lugar da imagem).
2. Local + data (como já é hoje).
3. **Selo de confirmados** (ex.: "🎟 128 confirmados") — só aparece se `confirmedAttendees` estiver preenchido.
4. Descrição do evento (como já é hoje).
5. **Atrações**: fileira de avatares circulares (foto ou inicial do nome) com o nome embaixo de cada um — a seção inteira só aparece se o evento tiver pelo menos uma atração cadastrada.
6. A perfuração de ingresso (`TicketPerforation`, já existente) separando as informações do evento do bloco de preço.
7. Preço + formulário de compra — **sem nenhuma mudança de comportamento**, continua postando pra `/api/checkout` exatamente como hoje.

## 7. Segurança

- `POST /api/upload` exige sessão autenticada antes de emitir o token de upload (mesmo padrão de `POST /api/tickets/validate`, Fase 5) — sem isso, qualquer visitante anônimo poderia consumir a cota de armazenamento do projeto.
- `addAttractionAction`/`removeAttractionAction` seguem o padrão canônico de tenant-scoping: toda escrita exige `organizerId` da sessão **e** o id do recurso (evento ou atração) juntos na mesma query — nunca por id isolado. `removeAttractionAction` usa `organizerId` diretamente (denormalizado em `Attraction`), sem precisar de join até `Event`.
- Validação de input com Zod: nome da atração (`trim().min(1)`), `confirmedAttendees` (`coerce.number().int().nonnegative()`, opcional), `photoUrl`/`coverImageUrl` (`url()`, opcional) — mesmo padrão já usado em `eventSchema`.

## 8. Testes

- `attractionRepository`: criar, remover (com isolamento de tenant — outro organizador não consegue remover atração de evento que não é seu), listar em ordem de criação.
- `eventRepository`: `findEventForOrganizer`/`findEventBySlug` passam a incluir `attractions` — teste confirmando o include.
- `POST /api/upload`: teste do gate de autorização (`onBeforeGenerateToken` rejeita sem sessão) com o SDK do Vercel Blob mockado — mesmo padrão de mock já usado para o SDK do Mercado Pago (Fase 4).
- Verificação manual no navegador (mesma ressalva já registrada nas fases anteriores para fluxos que dependem de credenciais externas): upload real de imagem exige `BLOB_READ_WRITE_TOKEN` configurado; sem ele, o formulário deve continuar funcionando normalmente para os campos que não dependem de imagem.

## 9. Fora de Escopo (nesta versão)

- Galeria de múltiplas imagens por evento.
- Contagem automática de confirmados a partir de ingressos vendidos.
- Reordenar atrações manualmente.
- Editar/remover a capa ou a foto de uma atração já enviada (fluxo atual: trocar o arquivo reenvia e substitui a URL guardada; não há um botão "remover capa" dedicado).
