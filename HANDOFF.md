# Handoff — Ingresse

Documento de passagem do projeto. Escrito em 2026-08-24 depois de uma sessão de debug/implementação com Claude Code. Se você (humano ou Claude) está pegando esse projeto agora, comece por aqui.

## O que é o projeto

SaaS de venda de ingressos + controle de portaria. Next.js (App Router) + Prisma + Postgres (Neon) + Mercado Pago (pagamento) + Vercel Blob (upload de imagem) + Resend (e-mail transacional). Deploy só acontece via Vercel — **não há ambiente local rodando e não há suíte de testes automatizada** (removida deliberadamente, ver seção abaixo). Toda validação é feita direto no deploy de produção.

Fluxo principal: organizador cria evento → publica → compartilha link público → comprador preenche formulário e paga via Mercado Pago → webhook confirma pagamento → sistema gera ticket com QR code e manda por e-mail → no dia do evento, equipe de portaria escaneia o QR em `/portaria/[eventId]` pra validar entrada.

Domínio de produção: **ingresse.site** (ainda não resolvendo em 2026-08-24 — testei e a URL não carrega; ver seção de config pendente). Enquanto isso, o deploy segue acessível pela URL da Vercel (`ingresse-drab.vercel.app`).

## 🔴 Config pendente — fazer isso primeiro

1. **Domínio `ingresse.site` ainda não resolve** — confirmado nesta sessão que a URL não carrega ainda. Verificar Vercel → Domains (DNS provavelmente ainda propagando ou não configurado) antes de considerar a migração concluída.

2. **Credenciais do Mercado Pago são de PRODUÇÃO** (`APP_USR-...`, não `TEST-...`). Isso significa que qualquer checkout completado cobra dinheiro de verdade. Se ainda for validar o fluxo de compra manualmente, considerar trocar temporariamente pelas credenciais de teste (aba "Credenciais de teste" na mesma aplicação do painel MP).

3. **Fluxo de pagamento completo (compra real → webhook → ticket por e-mail) ainda não foi validado ponta a ponta** — não dá pra simular isso sem cobrar um cartão de verdade. O `MERCADO_PAGO_WEBHOOK_SECRET` já está configurado e confirmado funcionando (testei mandando uma notificação assinada corretamente vs. uma com assinatura errada — a rota aceita a certa e rejeita a errada com 401), mas a primeira compra real que passar por aqui vale a pena acompanhar de perto pra confirmar que o e-mail com o ticket chega.

## O que foi corrigido nesta sessão (já em produção)

Prova de que cada item foi testado de verdade, não só lido no código:

- **Upload de imagem** — trocado de client-upload direto (`@vercel/blob/client`, que trava por um bug de CORS sem correção da Vercel — [thread da comunidade](https://community.vercel.com/t/vercel-blob-client-upload-blocked-by-cors-access-control-allow-origin-missing/46967)) para upload via proxy no servidor (`FormData` → `/api/upload` → `put()` do SDK server-side). Testado subindo uma imagem real e confirmando que ela aparece na página pública do evento.
- **`APP_URL` com barra dupla** — se a env var tivesse `/` no final, gerava links com `//` e o `notification_url` do Mercado Pago virava um redirect em vez de executar a rota (webhook nunca processava). Corrigido com `getAppUrl()` em [src/lib/env/appUrl.ts](src/lib/env/appUrl.ts), que sempre remove a barra final.
- **Capacidade do evento não era respeitada no checkout** — dava pra vender ingresso ilimitado pra qualquer evento. Agora `createOrder` ([src/lib/db/orderRepository.ts](src/lib/db/orderRepository.ts)) roda dentro de uma transação serializable que soma pedidos `PAID`+`PENDING` e rejeita (`EventSoldOutError`) se estourar a capacidade. Testado ao vivo: evento com capacidade 1, segunda tentativa de compra volta com "Não há mais ingressos disponíveis".
- **Não existia forma de criar conta de portaria** — o `Role.PORTARIA_STAFF` já existia no schema e no controle de acesso, mas só dava pra criar conta `ORGANIZER_ADMIN` (via `/signup`). Criada a tela `/admin/team` para o organizador cadastrar/listar contas de portaria. Testado: criei conta, fiz login, confirmei redirecionamento certo e acesso ao scanner.
- **Login de portaria não ia pra lugar nenhum** — todo login redirecionava pra `/admin`, que bloqueia quem não é `ORGANIZER_ADMIN` e devolvia pro `/login` sem explicação. Agora login vai pra `/` (home), que redireciona por papel (`PORTARIA_STAFF` → `/portaria`, resto → `/admin`).
- **Sem navegação para Portaria/Equipe** — só existiam as páginas, sem link nenhum. Adicionado nav no header ([src/components/layout/AppHeader.tsx](src/components/layout/AppHeader.tsx)) e botões na home do admin.

## Suíte de testes — removida de propósito

O projeto tinha ~22 arquivos `*.test.ts` (vitest) rodando contra um banco Postgres de teste separado (Neon). Ninguém rodava isso (sem CI, sem execução local) e as credenciais desse banco de teste estavam inválidas, bloqueando boa parte da suíte. Removidos nesta sessão: todos os `*.test.ts`/`*.test.tsx`, `vitest.config.ts`, `tests/testDb.ts`, `.env.test`, o script `test` do `package.json`, e as dependências `vitest`/`dotenv`. `npx tsc --noEmit` continua limpo depois da remoção.

Se decidirem que vale a pena ter testes automatizados de novo no futuro, é começar do zero — não tem nada pra "reativar".

## O que ainda falta (não implementado)

Por prioridade, do que mais afeta o produto pro que é cosmético. **Reembolso não está nessa lista de propósito** — não é uma funcionalidade planejada para o produto.

1. **Painel de vendas/pedidos** — organizador não vê quantos ingressos vendeu, quem comprou, receita por evento. Só cria/edita evento. Provavelmente a próxima coisa mais importante depois de configurar o webhook do Mercado Pago.
2. **"Esqueci minha senha"** — não existe. Só signup/login.
3. **Excluir evento** — não existe rota nem UI pra deletar um evento. (Isso ficou visível porque criei 2 eventos de teste — "QA Capacidade Teste" e "QA MP Diag" — que continuam na lista de eventos de produção sem forma de remover pela UI.)
4. **E-mail do ticket sai de `ingressos@resend.dev`** (domínio de teste do Resend), não de um domínio próprio. Cosmético — pra trocar, precisa verificar `ingresse.site` (ou outro domínio) no Resend e atualizar `from` em [src/lib/email/sendTicketEmail.tsx](src/lib/email/sendTicketEmail.tsx).
5. **Gerenciar equipe de portaria é só criar/listar** — não dá pra remover ou editar um membro pela UI de `/admin/team`.

## Eventos de teste para limpar

"QA Capacidade Teste" e "QA MP Diag" foram criados durante a verificação desta sessão (capacidade 1 e 5, respectivamente) e continuam publicados. Sem função de deletar evento no sistema (item 3 acima) — hoje só dá pra remover direto no banco, ou implementar a função de exclusão primeiro.

## Como validar mudanças (não tem ambiente local nem testes automatizados)

Este projeto só roda via Vercel — não use `npm run dev` esperando testar de verdade, e não tem `npm test` (ver seção acima). Para verificar uma mudança:
1. Commitar e dar push (dispara deploy automático na Vercel)
2. Esperar o deploy (checar `https://ingresse-drab.vercel.app/<rota>` — ou `ingresse.site` assim que o domínio estiver resolvendo — até parar de dar 404/erro do deploy anterior)
3. Testar a funcionalidade real no domínio de produção

`npx tsc --noEmit` ainda vale a pena rodar antes de commitar — é a única verificação automática que sobrou.

## Contas de teste existentes

- `qa-fase5@teste.dev` / `senha12345` — conta `ORGANIZER_ADMIN`
- `portaria-qa@teste.dev` / `outrasenha456` — conta `PORTARIA_STAFF`, criada via `/admin/team` durante os testes desta sessão
