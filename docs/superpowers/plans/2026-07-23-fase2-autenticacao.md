# Fase 2 — Autenticação (Auth.js + RBAC) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organizadores conseguem criar conta (o que cria seu `Organizer` + o primeiro `User` com role `ORGANIZER_ADMIN`) e fazer login; rotas `/admin/*` e `/portaria/*` ficam protegidas por sessão e por role (RBAC), usando Auth.js (NextAuth v5).

**Architecture:** Auth.js v5 (App Router nativo) com `CredentialsProvider` (e-mail/senha), sessão via JWT. A lógica de negócio (hash de senha, busca de usuário, verificação de credenciais, decisão de autorização por rota) vive em módulos puros e testáveis fora do NextAuth; o NextAuth em si é só a camada de wiring/glue (config + middleware), verificada por build e não por teste unitário direto.

**Tech Stack:** next-auth (v5/"Auth.js", beta), bcryptjs (hash de senha — evita compilação nativa do `bcrypt`, mais confiável em Windows), Prisma (já existente).

## Global Constraints

- Nomenclatura obrigatória: camelCase para variáveis, funções, rotas e colunas de banco. (spec, seção 1)
- Isolamento multi-tenant é row-level via `organizerId`. Toda busca tenant-scoped usa o padrão canônico já estabelecido em `findEventForOrganizer` (Fase 1): exigir `organizerId` E o id do recurso juntos via `findFirst`, nunca buscar por id isolado. (spec, seção 6; `src/lib/db/eventRepository.ts`)
- RBAC via campo `role` do model `User`: `ORGANIZER_ADMIN` ou `PORTARIA_STAFF`. (spec, seção 8)
- Sessão via JWT (Auth.js `session.strategy = "jwt"`). (spec, seção 8)
- Banco: Postgres via Neon. ORM: Prisma — todo acesso ao banco passa por ele. (spec, seção 4)

## Nota arquitetural — decisão em aberto, não resolvida nesta fase

A revisão final da Fase 1 registrou que o isolamento multi-tenant hoje depende só de **convenção de código** (todo repositório precisa lembrar de exigir `organizerId`) — nada no banco ou no Prisma impede estruturalmente que uma rota futura esqueça o filtro. Esta fase adiciona `userRepository.ts`, que é o **segundo** caminho de escrita tenant-scoped do projeto (depois de `Event`), seguindo a mesma convenção (não resolve o débito, só o mantém consistente). Uma decisão sobre reforço estrutural (Row-Level Security no Postgres, ou uma Prisma Client Extension que injete o filtro automaticamente) continua em aberto — recomendo tomá-la antes da Fase 3 (CRUD de eventos), que será o primeiro lugar onde um `ORGANIZER_ADMIN` edita dados via UI.

## Escopo desta fase

Cobre: hash de senha, `userRepository` com testes de isolamento, criação de organizador+admin em transação, verificação de credenciais, decisão de autorização por rota (testável isoladamente), configuração do Auth.js, middleware de proteção de rota, páginas mínimas de login/cadastro/logout (Tailwind básico, **sem** o tema visual definitivo — isso é escopo da Fase 6). Não cobre: recuperação de senha, convite de staff por e-mail, verificação de e-mail, 2FA — nenhum desses foi pedido na spec. Não inclui Playwright/e2e (a spec reserva isso para os fluxos críticos de checkout/scanner, fases futuras); a verificação desta fase é via Vitest para toda a lógica extraída em módulos puros, e `npm run build` + roteiro manual para a cola do Next.js/Auth.js em si.

---

### Task 1: Hash de senha (bcryptjs)

**Files:**
- Create: `src/lib/auth/password.ts`
- Test: `src/lib/auth/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(plainPassword: string): Promise<string>`, `verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean>` — usados por `verifyCredentials` (Task 4) e pelas páginas de cadastro (Task 8).

- [ ] **Step 1: Instalar bcryptjs**

Run: `npm install bcryptjs && npm install -D @types/bcryptjs`
Expected: instala sem erros (bcryptjs é JS puro, sem compilação nativa — evita problemas comuns no Windows).

- [ ] **Step 2: Escrever o teste que falha primeiro**

Create `src/lib/auth/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("hashes a password and verifies it matches", async () => {
    const hash = await hashPassword("supersecret123");

    const matches = await verifyPassword("supersecret123", hash);

    expect(matches).toBe(true);
  });

  it("rejects an incorrect password against the hash", async () => {
    const hash = await hashPassword("supersecret123");

    const matches = await verifyPassword("wrongpassword", hash);

    expect(matches).toBe(false);
  });

  it("produces a hash different from the plain password", async () => {
    const hash = await hashPassword("supersecret123");

    expect(hash).not.toBe("supersecret123");
  });
});
```

Also create an empty `src/lib/auth/password.ts` (no exports yet).

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npm test -- password`
Expected: FAIL — `hashPassword` e `verifyPassword` não existem.

- [ ] **Step 4: Implementar `src/lib/auth/password.ts`**

```ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plainPassword: string) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string,
) {
  return bcrypt.compare(plainPassword, passwordHash);
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm test -- password`
Expected: PASS — 3 testes passando.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/auth/password.ts src/lib/auth/password.test.ts
git commit -m "feat: add password hashing with bcryptjs"
```

---

### Task 2: userRepository com isolamento multi-tenant

**Files:**
- Create: `src/lib/db/userRepository.ts`
- Test: `src/lib/db/userRepository.test.ts`

**Interfaces:**
- Consumes: `prisma` de `src/lib/db/prismaClient.ts`; `resetDatabase`, `testPrisma` de `tests/testDb.ts`.
- Produces: `createUser(organizerId, input)`, `findUserByEmail(email)`, `findUserForOrganizer(organizerId, userId)` — `findUserByEmail` é usado por `verifyCredentials` (Task 4); `findUserForOrganizer` segue o padrão canônico e ficará disponível para fases futuras (ex: tela de gestão de staff).

- [ ] **Step 1: Escrever os testes que falham primeiro**

Create `src/lib/db/userRepository.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { resetDatabase, testPrisma } from "../../../tests/testDb";
import {
  createUser,
  findUserByEmail,
  findUserForOrganizer,
} from "./userRepository";

describe("userRepository", () => {
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

  it("creates a user scoped to the organizer", async () => {
    const user = await createUser(organizerAId, {
      name: "Staff A1",
      email: "staffa1@organizador.dev",
      passwordHash: "hash",
      role: Role.PORTARIA_STAFF,
    });

    expect(user.organizerId).toBe(organizerAId);
  });

  it("finds a user by email regardless of organizer", async () => {
    await createUser(organizerAId, {
      name: "Staff A1",
      email: "staffa1@organizador.dev",
      passwordHash: "hash",
      role: Role.PORTARIA_STAFF,
    });

    const found = await findUserByEmail("staffa1@organizador.dev");

    expect(found?.organizerId).toBe(organizerAId);
  });

  it("does not return another organizer's user", async () => {
    const user = await createUser(organizerAId, {
      name: "Staff A1",
      email: "staffa1@organizador.dev",
      passwordHash: "hash",
      role: Role.PORTARIA_STAFF,
    });

    const foundByOwner = await findUserForOrganizer(organizerAId, user.id);
    const foundByOther = await findUserForOrganizer(organizerBId, user.id);

    expect(foundByOwner?.id).toBe(user.id);
    expect(foundByOther).toBeNull();
  });
});
```

Also create an empty `src/lib/db/userRepository.ts` (no exports yet).

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- userRepository`
Expected: FAIL — `createUser`, `findUserByEmail` e `findUserForOrganizer` não existem.

- [ ] **Step 3: Implementar `src/lib/db/userRepository.ts`**

```ts
import type { Role } from "@prisma/client";
import { prisma } from "./prismaClient";

type CreateUserInput = {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
};

export async function createUser(organizerId: string, input: CreateUserInput) {
  return prisma.user.create({ data: { organizerId, ...input } });
}

// Busca global por e-mail — necessária para o login, que acontece antes de
// sabermos a qual organizerId o usuário pertence. E-mail é @unique no
// schema, então essa busca não vaza dado de outro tenant: cada e-mail
// pertence a exatamente um usuário/organizador.
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

// Padrão canônico de tenant-scoping (mesmo de findEventForOrganizer, Fase
// 1): sempre exige organizerId E o id do recurso juntos via findFirst,
// nunca busca por id isolado — evita vazamento de dado entre organizadores.
export async function findUserForOrganizer(
  organizerId: string,
  userId: string,
) {
  return prisma.user.findFirst({ where: { id: userId, organizerId } });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- userRepository`
Expected: PASS — 3 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/userRepository.ts src/lib/db/userRepository.test.ts
git commit -m "feat: add tenant-scoped userRepository with isolation tests"
```

---

### Task 3: Criação de Organizer + primeiro admin em transação

**Files:**
- Modify: `src/lib/db/organizerRepository.ts` (adicionar função nova, não remover as existentes)
- Modify: `src/lib/db/organizerRepository.test.ts` (adicionar testes novos, não remover os existentes)

**Interfaces:**
- Consumes: `prisma` de `src/lib/db/prismaClient.ts`.
- Produces: `createOrganizerWithAdminUser(input): Promise<{ organizer: Organizer; adminUser: User }>` — usado pela página de cadastro (Task 8).

- [ ] **Step 1: Escrever os testes que falham primeiro**

Add to `src/lib/db/organizerRepository.test.ts` (mantendo os testes existentes de `createOrganizer`/`findOrganizerById`, adicione um novo `describe` e o import de `Role`):

```ts
import { Role } from "@prisma/client";
// (mantenha os imports já existentes no arquivo, adicione este)
```

```ts
describe("createOrganizerWithAdminUser", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates an organizer and its first admin user together", async () => {
    const result = await createOrganizerWithAdminUser({
      organizerName: "Organizador Completo",
      organizerEmail: "completo@organizador.dev",
      adminName: "Admin Completo",
      adminEmail: "completo@organizador.dev",
      passwordHash: "hash",
    });

    expect(result.organizer.name).toBe("Organizador Completo");
    expect(result.adminUser.organizerId).toBe(result.organizer.id);
    expect(result.adminUser.role).toBe(Role.ORGANIZER_ADMIN);
  });

  it("throws when the email is already in use", async () => {
    await createOrganizerWithAdminUser({
      organizerName: "Organizador 1",
      organizerEmail: "duplicado@organizador.dev",
      adminName: "Admin 1",
      adminEmail: "duplicado@organizador.dev",
      passwordHash: "hash",
    });

    await expect(
      createOrganizerWithAdminUser({
        organizerName: "Organizador 2",
        organizerEmail: "duplicado@organizador.dev",
        adminName: "Admin 2",
        adminEmail: "duplicado@organizador.dev",
        passwordHash: "hash",
      }),
    ).rejects.toThrow();
  });
});
```

Add the import `createOrganizerWithAdminUser` to the existing import line from `./organizerRepository` at the top of the test file.

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- organizerRepository`
Expected: FAIL — `createOrganizerWithAdminUser` não existe.

- [ ] **Step 3: Implementar em `src/lib/db/organizerRepository.ts`**

Add the `Role` import at the top (alongside the existing `prisma` import) and append this function at the end of the file, after the existing `createOrganizer`/`findOrganizerById`:

```ts
import { Role } from "@prisma/client";
```

```ts
export async function createOrganizerWithAdminUser(input: {
  organizerName: string;
  organizerEmail: string;
  adminName: string;
  adminEmail: string;
  passwordHash: string;
}) {
  return prisma.$transaction(async (tx) => {
    const organizer = await tx.organizer.create({
      data: { name: input.organizerName, email: input.organizerEmail },
    });

    const adminUser = await tx.user.create({
      data: {
        organizerId: organizer.id,
        name: input.adminName,
        email: input.adminEmail,
        passwordHash: input.passwordHash,
        role: Role.ORGANIZER_ADMIN,
      },
    });

    return { organizer, adminUser };
  });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- organizerRepository`
Expected: PASS — todos os testes do arquivo (existentes + 2 novos) passando.

- [ ] **Step 5: Rodar a suíte completa**

Run: `npm test`
Expected: PASS — todos os testes de todos os arquivos passando.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/organizerRepository.ts src/lib/db/organizerRepository.test.ts
git commit -m "feat: add createOrganizerWithAdminUser transaction"
```

---

### Task 4: Verificação de credenciais (login)

**Files:**
- Create: `src/lib/auth/verifyCredentials.ts`
- Test: `src/lib/auth/verifyCredentials.test.ts`

**Interfaces:**
- Consumes: `hashPassword`, `verifyPassword` de `src/lib/auth/password.ts` (Task 1); `findUserByEmail` de `src/lib/db/userRepository.ts` (Task 2).
- Produces: `verifyCredentials(email: string, password: string): Promise<{ id: string; organizerId: string; role: Role; name: string; email: string } | null>` — usado pelo `CredentialsProvider` do Auth.js (Task 6).

- [ ] **Step 1: Escrever os testes que falham primeiro**

Create `src/lib/auth/verifyCredentials.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { resetDatabase, testPrisma } from "../../../tests/testDb";
import { hashPassword } from "./password";
import { verifyCredentials } from "./verifyCredentials";

describe("verifyCredentials", () => {
  let organizerId: string;

  beforeEach(async () => {
    await resetDatabase();
    const organizer = await testPrisma.organizer.create({
      data: { name: "Organizador Teste", email: "org@teste.dev" },
    });
    organizerId = organizer.id;
    const passwordHash = await hashPassword("senhaCorreta123");
    await testPrisma.user.create({
      data: {
        organizerId,
        name: "Usuário Teste",
        email: "user@teste.dev",
        passwordHash,
        role: Role.ORGANIZER_ADMIN,
      },
    });
  });

  it("returns the user when email and password match", async () => {
    const result = await verifyCredentials(
      "user@teste.dev",
      "senhaCorreta123",
    );

    expect(result?.email).toBe("user@teste.dev");
    expect(result?.organizerId).toBe(organizerId);
  });

  it("returns null when the password is wrong", async () => {
    const result = await verifyCredentials("user@teste.dev", "senhaErrada");

    expect(result).toBeNull();
  });

  it("returns null when the email does not exist", async () => {
    const result = await verifyCredentials("naoexiste@teste.dev", "qualquer");

    expect(result).toBeNull();
  });
});
```

Also create an empty `src/lib/auth/verifyCredentials.ts` (no exports yet).

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- verifyCredentials`
Expected: FAIL — `verifyCredentials` não existe.

- [ ] **Step 3: Implementar `src/lib/auth/verifyCredentials.ts`**

```ts
import { findUserByEmail } from "@/lib/db/userRepository";
import { verifyPassword } from "./password";

export async function verifyCredentials(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) {
    return null;
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    return null;
  }

  return {
    id: user.id,
    organizerId: user.organizerId,
    role: user.role,
    name: user.name,
    email: user.email,
  };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- verifyCredentials`
Expected: PASS — 3 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/verifyCredentials.ts src/lib/auth/verifyCredentials.test.ts
git commit -m "feat: add credential verification for login"
```

---

### Task 5: Decisão de autorização por rota (função pura)

**Files:**
- Create: `src/lib/auth/routeAccess.ts`
- Test: `src/lib/auth/routeAccess.test.ts`

**Interfaces:**
- Produces: `isAuthorizedForPath(role: Role | undefined, pathname: string): boolean` — usado pelo `middleware.ts` (Task 7). Extraído como função pura justamente para ser testável sem precisar de infraestrutura de middleware do Next.js.

- [ ] **Step 1: Escrever o teste que falha primeiro**

Create `src/lib/auth/routeAccess.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isAuthorizedForPath } from "./routeAccess";

describe("isAuthorizedForPath", () => {
  it("allows ORGANIZER_ADMIN into /admin routes", () => {
    expect(isAuthorizedForPath("ORGANIZER_ADMIN", "/admin")).toBe(true);
    expect(isAuthorizedForPath("ORGANIZER_ADMIN", "/admin/events")).toBe(
      true,
    );
  });

  it("blocks PORTARIA_STAFF from /admin routes", () => {
    expect(isAuthorizedForPath("PORTARIA_STAFF", "/admin")).toBe(false);
  });

  it("blocks unauthenticated (undefined role) from /admin routes", () => {
    expect(isAuthorizedForPath(undefined, "/admin")).toBe(false);
  });

  it("allows both roles into /portaria routes", () => {
    expect(isAuthorizedForPath("ORGANIZER_ADMIN", "/portaria")).toBe(true);
    expect(isAuthorizedForPath("PORTARIA_STAFF", "/portaria")).toBe(true);
  });

  it("blocks unauthenticated (undefined role) from /portaria routes", () => {
    expect(isAuthorizedForPath(undefined, "/portaria")).toBe(false);
  });

  it("allows any role into public routes", () => {
    expect(isAuthorizedForPath(undefined, "/")).toBe(true);
    expect(isAuthorizedForPath(undefined, "/login")).toBe(true);
  });
});
```

Also create an empty `src/lib/auth/routeAccess.ts` (no exports yet).

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- routeAccess`
Expected: FAIL — `isAuthorizedForPath` não existe.

- [ ] **Step 3: Implementar `src/lib/auth/routeAccess.ts`**

```ts
import type { Role } from "@prisma/client";

export function isAuthorizedForPath(
  role: Role | undefined,
  pathname: string,
): boolean {
  if (pathname.startsWith("/admin")) {
    return role === "ORGANIZER_ADMIN";
  }
  if (pathname.startsWith("/portaria")) {
    return role === "ORGANIZER_ADMIN" || role === "PORTARIA_STAFF";
  }
  return true;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- routeAccess`
Expected: PASS — 6 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/routeAccess.ts src/lib/auth/routeAccess.test.ts
git commit -m "feat: add pure route authorization logic"
```

---

### Task 6: Configuração do Auth.js (NextAuth v5)

**Files:**
- Create: `src/lib/auth/authConfig.ts`
- Create: `src/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `types/next-auth.d.ts`

**Interfaces:**
- Consumes: `verifyCredentials` de `src/lib/auth/verifyCredentials.ts` (Task 4).
- Produces: `auth`, `signIn`, `signOut`, `handlers` exportados de `src/auth.ts` — usados pelo `middleware.ts` (Task 7) e pelas páginas de login/cadastro (Task 8). `Session.user` ganha os campos `id`, `organizerId`, `role` (tipados via `types/next-auth.d.ts`).

- [ ] **Step 1: Instalar o Auth.js v5**

Run: `npm install next-auth@beta`
Expected: instala sem erros. Confirme no `package.json` que a versão instalada de `next-auth` é `5.x` (beta) — se o npm resolver outra major, pare e reporte BLOCKED.

- [ ] **Step 2: Criar `types/next-auth.d.ts`**

```ts
import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      organizerId: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    organizerId: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    organizerId: string;
    role: Role;
  }
}
```

- [ ] **Step 3: Criar `src/lib/auth/authConfig.ts`**

```ts
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyCredentials } from "./verifyCredentials";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }
        return verifyCredentials(email, password);
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.userId = user.id;
        token.organizerId = user.organizerId;
        token.role = user.role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.userId;
      session.user.organizerId = token.organizerId;
      session.user.role = token.role;
      return session;
    },
  },
};
```

- [ ] **Step 4: Criar `src/auth.ts`**

```ts
import NextAuth from "next-auth";
import { authConfig } from "./lib/auth/authConfig";

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
```

- [ ] **Step 5: Criar `src/app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 6: Verificar que o projeto compila**

Run: `npm run build`
Expected: build conclui com sucesso, sem erros de tipo (a config do Auth.js e a augmentação de tipos em `types/next-auth.d.ts` são fortemente tipadas — qualquer incompatibilidade de campo aparece aqui).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json types/next-auth.d.ts src/lib/auth/authConfig.ts src/auth.ts src/app/api/auth
git commit -m "feat: configure Auth.js with credentials provider and JWT session"
```

---

### Task 7: Middleware de proteção de rota + páginas protegidas mínimas

**Files:**
- Create: `middleware.ts` (raiz do projeto, convenção do Next.js)
- Create: `src/app/admin/page.tsx`
- Create: `src/app/portaria/page.tsx`

**Interfaces:**
- Consumes: `auth` de `src/auth.ts` (Task 6); `isAuthorizedForPath` de `src/lib/auth/routeAccess.ts` (Task 5).
- Produces: rotas `/admin` e `/portaria` protegidas — qualquer página futura criada sob esses caminhos (Fases 3 e 5) herda a proteção automaticamente via `matcher`.

**Nota:** a spec original descrevia o painel do organizador como `/app/(admin)` (route group entre parênteses). Route groups do Next.js não aparecem na URL nem no `pathname` — o middleware não conseguiria protegê-los por caminho. Por isso este plano usa `/app/admin` (segmento real, URL `/admin`) em vez do route group — é uma correção técnica necessária para a proteção de rota funcionar, não uma mudança de escopo.

- [ ] **Step 1: Criar `middleware.ts`**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAuthorizedForPath } from "@/lib/auth/routeAccess";

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const role = request.auth?.user?.role;

  if (!request.auth) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (!isAuthorizedForPath(role, pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/portaria/:path*"],
};
```

- [ ] **Step 2: Criar `src/app/admin/page.tsx`**

```tsx
import { auth } from "@/auth";

export default async function AdminHomePage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p>
        Logado como {session?.user?.name} ({session?.user?.role})
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Criar `src/app/portaria/page.tsx`**

```tsx
import { auth } from "@/auth";

export default async function PortariaHomePage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p>
        Portaria — logado como {session?.user?.name} ({session?.user?.role})
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Verificar que o projeto compila**

Run: `npm run build`
Expected: build conclui com sucesso; `/admin` e `/portaria` aparecem na listagem de rotas geradas.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts src/app/admin src/app/portaria
git commit -m "feat: add route protection middleware and protected placeholder pages"
```

---

### Task 8: Páginas de login, cadastro e logout

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/signup/page.tsx`
- Modify: `src/app/admin/page.tsx:1-12` (adicionar link/botão de logout)

**Interfaces:**
- Consumes: `signIn`, `signOut` de `src/auth.ts` (Task 6); `hashPassword` de `src/lib/auth/password.ts` (Task 1); `createOrganizerWithAdminUser` de `src/lib/db/organizerRepository.ts` (Task 3).

- [ ] **Step 1: Criar `src/app/login/page.tsx`**

```tsx
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

async function loginAction(formData: FormData) {
  "use server";

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form action={loginAction} className="flex w-80 flex-col gap-4">
        <h1 className="text-xl font-semibold">Entrar</h1>
        {error && (
          <p className="text-sm text-red-500">E-mail ou senha inválidos.</p>
        )}
        <input
          name="email"
          type="email"
          placeholder="E-mail"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Senha"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-2 text-white"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Criar `src/app/signup/page.tsx`**

```tsx
import { Prisma } from "@prisma/client";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { hashPassword } from "@/lib/auth/password";
import { createOrganizerWithAdminUser } from "@/lib/db/organizerRepository";

async function signupAction(formData: FormData) {
  "use server";

  const organizerName = String(formData.get("organizerName") ?? "");
  const adminName = String(formData.get("adminName") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const passwordHash = await hashPassword(password);

  try {
    await createOrganizerWithAdminUser({
      organizerName,
      organizerEmail: email,
      adminName,
      adminEmail: email,
      passwordHash,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirect("/signup?error=email-in-use");
    }
    throw error;
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/admin" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw error;
  }
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form action={signupAction} className="flex w-80 flex-col gap-4">
        <h1 className="text-xl font-semibold">Criar conta de organizador</h1>
        {error && (
          <p className="text-sm text-red-500">
            Não foi possível criar a conta. Tente outro e-mail.
          </p>
        )}
        <input
          name="organizerName"
          placeholder="Nome da organização"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="adminName"
          placeholder="Seu nome"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="email"
          type="email"
          placeholder="E-mail"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Senha"
          required
          minLength={8}
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-2 text-white"
        >
          Criar conta
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Adicionar logout em `src/app/admin/page.tsx`**

Replace the full file content with:

```tsx
import { auth, signOut } from "@/auth";

export default async function AdminHomePage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p>
        Logado como {session?.user?.name} ({session?.user?.role})
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit" className="rounded bg-gray-700 px-3 py-2 text-white">
          Sair
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Verificar que o projeto compila**

Run: `npm run build`
Expected: build conclui com sucesso; `/login` e `/signup` aparecem na listagem de rotas.

- [ ] **Step 5: Roteiro de verificação manual (sem Playwright nesta fase)**

Run: `npm run dev`, depois manualmente:
1. Acesse `http://localhost:3000/signup`, preencha o formulário e envie. Deve redirecionar para `/admin` mostrando "Logado como ... (ORGANIZER_ADMIN)".
2. Clique em "Sair". Deve redirecionar para `/login`.
3. Acesse `http://localhost:3000/admin` diretamente sem estar logado. Deve redirecionar para `/login` (middleware bloqueando).
4. Faça login em `/login` com o e-mail/senha criados no passo 1. Deve redirecionar para `/admin`.
5. Tente `/login` com senha errada. Deve mostrar "E-mail ou senha inválidos.".

Reporte o resultado de cada passo no relatório da task.

- [ ] **Step 6: Commit**

```bash
git add src/app/login src/app/signup src/app/admin/page.tsx
git commit -m "feat: add login, signup, and logout pages"
```

---

## Fim da Fase 2

Ao concluir: um organizador consegue se cadastrar, logar, acessar `/admin` (e futura equipe de portaria acessar `/portaria`), e sair — tudo com sessão JWT e RBAC reforçado por middleware. `npm test` cobre toda a lógica de negócio (hash, repositórios, verificação de credenciais, decisão de autorização); a cola do Next.js/Auth.js é verificada por build + roteiro manual. Próxima fase: **Fase 3 — CRUD de eventos (painel do organizador)**, que deve decidir a nota arquitetural em aberto (reforço estrutural do isolamento multi-tenant) antes de implementar as primeiras rotas de escrita de `Event` via UI.
