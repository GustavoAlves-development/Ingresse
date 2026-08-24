# Handoff — Ingresse

Documento de passagem do projeto. Escrito em 2026-08-24 depois de uma sessão de debug/implementação com Claude Code. Se você (humano ou Claude) está pegando esse projeto agora, comece por aqui.

## O que é o projeto

SaaS de venda de ingressos + controle de portaria. Next.js (App Router) + Prisma + Postgres (Neon) + Mercado Pago (pagamento) + Vercel Blob (upload de imagem) + Resend (e-mail transacional). Deploy só acontece via Vercel — **não há ambiente local rodando**, todo teste é feito direto no deploy.

Fluxo principal: organizador cria evento → publica → compartilha link público → comprador preenche formulário e paga via Mercado Pago → webhook confirma pagamento → sistema gera ticket com QR code e manda por e-mail → no dia do evento, equipe de portaria escaneia o QR em `/portaria/[eventId]` pra validar entrada.

Domínio de produção: **ingresse.site** (migrado de `ingresse-drab.vercel.app` durante essa sessão — ver seção de config pendente).

## 🔴 Config pendente — fazer isso primeiro

Sem isso o sistema não funciona de ponta a ponta:

1. **Migração de domínio para `ingresse.site`** (em andamento, iniciada nesta sessão):
   - [ ] Vercel → Domains → confirmar que `ingresse.site` está adicionado e o DNS resolvendo
   - [ ] Vercel → Settings → Environment Variables → `APP_URL` = `https://ingresse.site` (sem barra no final) → redeploy
   - [ ] Painel do Mercado Pago → Webhooks → atualizar a URL cadastrada para `https://ingresse.site/api/webhooks/mercadopago`

2. **`MERCADO_PAGO_WEBHOOK_SECRET`** — ainda não configurado. Sem ele, o Mercado Pago nunca consegue confirmar um pagamento (a rota rejeita a notificação por assinatura inválida) e **nenhum ticket é gerado mesmo com o pagamento aprovado**. Pegar em: painel MP → aplicação → Webhooks → configurar a URL acima com o evento "Pagamentos" → copiar a chave secreta gerada (não confundir com `client_secret`, que é de OAuth e não é usado aqui).

3. **Credenciais do Mercado Pago são de PRODUÇÃO** (`APP_USR-...`, não `TEST-...`). Isso significa que qualquer checkout completado agora cobra dinheiro de verdade. Decidir: manter assim, ou trocar por credenciais de teste (aba "Credenciais de teste" na mesma aplicação do painel MP) enquanto ainda estiver validando o sistema.

4. **Banco de dados de teste quebrado** (`.env.test`, `DATABASE_URL` de um Neon separado) — autenticação falhando (`authentication failed`). Isso bloqueia **54 dos 109 testes automatizados** (tudo que toca banco: order, ticket, event, user, organizer, attraction repositories + rotas de webhook/validate). `npx vitest run` mostra isso claramente. Precisa gerar credenciais novas desse branch/projeto Neon (ou apontar pra um novo) e atualizar `.env.test`.

## O que foi corrigido nesta sessão (já em produção)

Prova de que cada item foi testado de verdade, não só lido no código:

- **Upload de imagem** — trocado de client-upload direto (`@vercel/blob/client`, que trava por um bug de CORS sem correção da Vercel — [thread da comunidade](https://community.vercel.com/t/vercel-blob-client-upload-blocked-by-cors-access-control-allow-origin-missing/46967)) para upload via proxy no servidor (`FormData` → `/api/upload` → `put()` do SDK server-side). Testado subindo uma imagem real e confirmando que ela aparece na página pública do evento.
- **`APP_URL` com barra dupla** — se a env var tivesse `/` no final, gerava links com `//` e o `notification_url` do Mercado Pago virava um redirect em vez de executar a rota (webhook nunca processava). Corrigido com `getAppUrl()` em [src/lib/env/appUrl.ts](src/lib/env/appUrl.ts), que sempre remove a barra final.
- **Capacidade do evento não era respeitada no checkout** — dava pra vender ingresso ilimitado pra qualquer evento. Agora `createOrder` ([src/lib/db/orderRepository.ts](src/lib/db/orderRepository.ts)) roda dentro de uma transação serializable que soma pedidos `PAID`+`PENDING` e rejeita (`EventSoldOutError`) se estourar a capacidade. Testado ao vivo: evento com capacidade 1, segunda tentativa de compra volta com "Não há mais ingressos disponíveis".
- **Não existia forma de criar conta de portaria** — o `Role.PORTARIA_STAFF` já existia no schema e no controle de acesso, mas só dava pra criar conta `ORGANIZER_ADMIN` (via `/signup`). Criada a tela `/admin/team` para o organizador cadastrar/listar contas de portaria. Testado: criei conta, fiz login, confirmei redirecionamento certo e acesso ao scanner.
- **Login de portaria não ia pra lugar nenhum** — todo login redirecionava pra `/admin`, que bloqueia quem não é `ORGANIZER_ADMIN` e devolvia pro `/login` sem explicação. Agora login vai pra `/` (home), que redireciona por papel (`PORTARIA_STAFF` → `/portaria`, resto → `/admin`).
- **Sem navegação para Portaria/Equipe** — só existiam as páginas, sem link nenhum. Adicionado nav no header ([src/components/layout/AppHeader.tsx](src/components/layout/AppHeader.tsx)) e botões na home do admin.

## O que ainda falta (não implementado)

Por prioridade, do que mais afeta o produto pro que é cosmético:

1. **Painel de vendas/pedidos** — organizador não vê quantos ingressos vendeu, quem comprou, receita por evento. Só cria/edita evento. Provavelmente a próxima coisa mais importante depois da config pendente acima.
2. **Reembolso** — `OrderStatus.REFUNDED` existe no schema do Prisma mas nenhum código nunca seta esse status. Hoje, estornar um pedido só editando o banco na mão.
3. **"Esqueci minha senha"** — não existe. Só signup/login.
4. **Excluir evento** — não existe rota nem UI pra deletar um evento. (Isso ficou visível porque criei 2 eventos de teste — "QA Capacidade Teste" e "QA MP Diag" — que continuam na lista de eventos de produção sem forma de remover pela UI.)
5. **E-mail do ticket sai de `ingressos@resend.dev`** (domínio de teste do Resend), não de um domínio próprio. Cosmético — pra trocar, precisa verificar `ingresse.site` (ou outro domínio) no Resend e atualizar `from` em [src/lib/email/sendTicketEmail.tsx](src/lib/email/sendTicketEmail.tsx).
6. **Gerenciar equipe de portaria é só criar/listar** — não dá pra remover ou editar um membro pela UI de `/admin/team`.

## Eventos de teste para limpar

"QA Capacidade Teste" e "QA MP Diag" foram criados durante a verificação desta sessão (capacidade 1 e 5, respectivamente) e continuam publicados. Sem função de deletar evento no sistema (item 4 acima) — hoje só dá pra remover direto no banco, ou implementar a função de exclusão primeiro.

## Como validar mudanças (não tem ambiente local)

Este projeto só roda via Vercel — não use `npm run dev` esperando testar de verdade. Para verificar uma mudança:
1. Commitar e dar push (dispara deploy automático na Vercel)
2. Esperar o deploy (checar `https://ingresse.site/<rota>` até parar de dar 404/erro do deploy anterior)
3. Testar a funcionalidade real no domínio de produção

`npx tsc --noEmit` e `npx vitest run` (com a ressalva do banco de teste quebrado, item 4) ainda valem a pena rodar antes de commitar.

## Contas de teste existentes

- `qa-fase5@teste.dev` / `senha12345` — conta `ORGANIZER_ADMIN`
- `portaria-qa@teste.dev` / `outrasenha456` — conta `PORTARIA_STAFF`, criada via `/admin/team` durante os testes desta sessão
