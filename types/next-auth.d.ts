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

// next-auth/jwt re-exporta o tipo JWT de @auth/core/jwt via `export *`.
// A augmentação de tipos do TypeScript não propaga por re-export "estrela";
// ela precisa mirar o módulo onde a interface é originalmente declarada.
// next-auth/lib/index.d.ts importa `JWT` diretamente de "@auth/core/jwt"
// para tipar os callbacks (jwt/session), então essa é a augmentação que
// efetivamente afeta os tipos usados em src/lib/auth/authConfig.ts.
declare module "@auth/core/jwt" {
  interface JWT {
    userId: string;
    organizerId: string;
    role: Role;
  }
}
