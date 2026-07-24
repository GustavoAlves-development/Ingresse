# Fase 6 — Tema Visual Definitivo — Design & Implementation Plan

> **Nota sobre este documento:** ao contrário das Fases 1–5, esta fase é puramente visual (sem lógica de negócio nova, sem schema, sem rota nova). Não há ciclo RED/GREEN de testes automatizados por task — a verificação é visual, no navegador. Por isso este plano é executado diretamente (sem subagent-driven-development) por quem escreveu o design system abaixo, com verificação em `npm run dev` + captura de tela após cada task, e uma revisão final de código no fim. `npm test` e `npx tsc --noEmit` continuam rodando a cada task como rede de segurança de regressão.

**Goal:** Aplicar o tema visual definitivo (spec, seção 7) em todas as telas do produto — dark theme consistente, tipografia com identidade própria, componentes shadcn/ui reais em vez de `className` ad-hoc repetido, e o motivo assinatura do produto (o "canhoto de ingresso" perfurado) usado nos dois momentos que definem o produto: comprar um ingresso e validá-lo na portaria.

**Escopo:** Design tokens (cores, tipografia, radius) via CSS variables Tailwind v4; shadcn/ui inicializado e usado nos formulários/cards/botões de todas as páginas; header compartilhado para `/admin` e `/portaria`; alinhamento das cores de alerta do `QrScanner` (Fase 5) aos tokens definitivos. Fora de escopo: e-mail transacional (`TicketEmail.tsx` já usa HTML de e-mail com restrições próprias, não este design system), modo claro (produto é dark-only, sem toggle).

## Design System

### Paleta (nomes → uso)

| Token (CSS var) | Valor | Uso |
|---|---|---|
| `--background` | `#0a0a0f` | Fundo base (mandatado pela spec, seção 7) |
| `--foreground` | `#f2f2f5` | Texto principal (branco levemente suavizado, não puro, para reduzir fadiga sobre o fundo quase-preto) |
| `--card` / `--popover` | `#16161f` | Superfície dos cards — "cinza-chumbo" (mandatado pela spec) |
| `--secondary` / `--muted` | `#1c1c26` | Header/nav e superfícies secundárias (mandatado pela spec) |
| `--muted-foreground` | `#9a9aab` | Texto secundário (labels, metadados) |
| `--accent` | `#1b2440` | Fundo sutil de hover/seleção (tom azulado escuro, entre `--card` e `--primary`) |
| `--primary` | `#4b7fff` | Azul vibrante de CTA — mais claro/saturado que o azul escuro da marca, para ter contraste próprio (mandatado pela spec) |
| `--brand` *(custom, não-shadcn)* | `#16305c` | Azul escuro da marca — usado só no glow atrás da logo do header |
| `--destructive` | `#ff3b5c` | Vermelho vibrante — erros de formulário e alerta "já utilizado"/"inválido" do scanner (mandatado pela spec) |
| `--success` *(custom, não-shadcn)* | `#22e07a` | Verde vibrante — alerta de sucesso do scanner (mandatado pela spec) |
| `--border` | `rgba(255,255,255,0.08)` | Borda sutil de 1px dos cards (mandatado pela spec) |
| `--input` | `rgba(255,255,255,0.14)` | Borda dos campos de formulário (mais visível que `--border` para affordance de interação) |
| `--ring` | `#4b7fff` (= `--primary`) | Anel de foco — usa a mesma cor do CTA para reforçar "isto é interativo" |

`--brand` e `--success` não existem no template padrão do shadcn — são registrados manualmente em `@theme inline` (`--color-success`, `--color-success-foreground`) para gerar utilities Tailwind (`bg-success`, `text-success`, etc.), mesmo mecanismo dos tokens padrão.

### Tipografia

Três famílias, cada uma com um papel — nenhuma reaproveitada de outra:

- **Display/heading** (`--font-heading`): **Space Grotesk** — geométrica, técnica, com presença própria em títulos, nome de evento, preço em destaque. Usada com restrição (só em `CardTitle`/`h1`/`h2`), nunca em parágrafo.
- **Corpo/UI** (`--font-sans`): **Work Sans** — humanista, muito legível em tamanho pequeno (formulários do admin, listas), mais discreta que a display para não competir com ela.
- **Utilitária/dados** (`--font-mono`): **JetBrains Mono** — usada em preços como dado (não em headline), datas/horários e no `qrToken`-adjacent (id do ingresso, quando exibido) — dá a sensação de "código de acesso"/boarding pass, coerente com o domínio (ingressos).

Todas via `next/font/google` em `src/app/layout.tsx`, cada uma numa CSS variable própria.

### Layout

Duas "shells":

1. **App shell** (`/admin`, `/portaria`): header fixo no topo (`bg-secondary`), com um wordmark "ingresse" em `--font-heading` + glow azul sutil atrás (`--brand`, `blur` + `radial-gradient`, baixa opacidade — mandatado pela spec), nav com o nome do usuário e link de logout. Conteúdo em coluna centralizada (`max-w-3xl`/`max-w-md` conforme a página) sobre `--background`, com `Card`s para cada bloco de conteúdo.
2. **Página pública de vendas** (`/e/[slug]`): um único `Card` centralizado com a assinatura visual do produto (ver abaixo).

### Assinatura visual: o canhoto perfurado

O produto inteiro gira em torno de um objeto físico conhecido — o ingresso de papel, com sua linha de perfuração entre o canhoto e o corpo do ingresso. Essa é a assinatura visual, usada nos dois momentos que definem o produto:

- **Comprar** (`/e/[slug]`): uma linha pontilhada com dois "furos" circulares (círculos da cor do fundo, sobrepostos à borda do card) separa as informações do evento do bloco de preço + botão de compra — como se o preço fosse o canhoto que se destaca do ingresso.
- **Validar** (`QrScanner`, resultado do scan): a mesma linha pontilhada com furos separa o veredito (válido/já usado/inválido) do nome do comprador — o mesmo objeto, visto do outro lado do balcão.

Implementado como um componente `TicketPerforation` reutilizável (não CSS global) — restrito a esses dois pontos, não decorativo em toda a UI (moderação: o resto da interface fica quieta ao redor desse único elemento memorável).

### Movimento

Mínimo e funcional: glow pulsante já existe no alerta vermelho do scanner (Fase 5, `animate-pulse`) — mantido, é o único lugar onde pulso faz sentido (reforça leitura à distância na portaria, spec seção 7). Fade-in sutil no card da página pública ao carregar. Sem scroll-storytelling — são páginas curtas e funcionais, não uma landing page de marketing.

## Tasks

### Task 1: Design tokens + shadcn/ui base

**Files:**
- Modify: `src/app/globals.css` (tokens da tabela acima em `:root`, registro de `--color-success`/`--color-success-foreground` em `@theme inline`, glow utility)
- Modify: `src/app/layout.tsx` (3 fontes via `next/font/google`, `bg-background text-foreground` em vez do hex hardcoded)
- Already done nesta sessão: `npx shadcn@latest init --defaults` + `npx shadcn@latest add card input textarea label select field alert badge separator` (gerou `components.json`, `src/lib/utils.ts`, `src/components/ui/*`)

**Verificação:** `npm run dev`, abrir qualquer página, confirmar fundo `#0a0a0f`, texto legível, sem erro de console sobre fonte/CSS. `npm test` (regressão) + `npx tsc --noEmit`.

### Task 2: Header compartilhado (`/admin`, `/portaria`) + componente `TicketPerforation`

**Files:**
- Create: `src/components/layout/AppHeader.tsx` (Server Component: wordmark com glow, nome do usuário, botão sair)
- Create: `src/components/tickets/TicketPerforation.tsx` (linha pontilhada + furos)
- Modify: `src/app/admin/layout.tsx`, `src/app/portaria/layout.tsx` (novos — envolvem as páginas existentes com `<AppHeader />`)

**Verificação:** `/admin` e `/portaria` mostram o mesmo header, glow visível atrás do wordmark, botão sair funcional.

### Task 3: Páginas de autenticação + home (`/`, `/login`, `/signup`)

**Files:**
- Modify: `src/app/page.tsx`, `src/app/login/page.tsx`, `src/app/signup/page.tsx`

Migrar `<input>`/`<button>` crus para `Field`/`FieldLabel`/`Input`/`Button`, erros para `Alert`.

**Verificação:** fluxo de login e signup continuam funcionando (manual, navegador), visual consistente com os tokens.

### Task 4: Páginas do admin (home, lista, novo, editar evento)

**Files:**
- Modify: `src/app/admin/page.tsx`, `src/app/admin/events/page.tsx`, `src/app/admin/events/new/page.tsx`, `src/app/admin/events/[eventId]/edit/page.tsx`

Lista de eventos em `Card`s com `Badge` de status (`DRAFT`/`PUBLISHED`/`CLOSED` com cores distintas). Formulários migrados para `Field`/`Input`/`Textarea`/`Select`/`Button`.

**Verificação:** criar e editar evento continuam funcionando; status muda de cor visualmente.

### Task 5: Página pública de vendas (`/e/[slug]`)

**Files:**
- Modify: `src/app/e/[slug]/page.tsx`

Card único com `TicketPerforation` separando informações do evento do preço/CTA — a peça mais "de marca" do produto (é o que o comprador final vê).

**Verificação:** checkout continua funcionando (POST para `/api/checkout` inalterado), visual com a assinatura do canhoto.

### Task 6: Páginas da portaria + alinhamento de cores do `QrScanner`

**Files:**
- Modify: `src/app/portaria/page.tsx`, `src/app/portaria/[eventId]/page.tsx`
- Modify: `src/components/portaria/QrScanner.tsx` — trocar as cores hardcoded (`RESULT_STYLES`, criado na Fase 5) pelos tokens `--success`/`--destructive` definitivos desta fase, e usar `TicketPerforation` entre o veredito e o nome do comprador.

**Verificação:** fluxo completo de scan (SUCCESS → ALREADY_USED, já validado end-to-end na Fase 5) continua funcionando; cores agora vêm dos tokens, não de valores soltos.

### Fechamento

`npm test` completo + `npx tsc --noEmit` limpos. Revisão final de código (mesmo padrão das Fases 1–5: uma revisão de branch inteiro antes de considerar a fase pronta), focada em consistência (nenhuma cor hardcoded fora dos tokens, nenhuma classe `gray-*`/`blue-*` residual das telas antigas) e regressão funcional (nenhum fluxo quebrado pela troca de markup).
