import type { NextAuthConfig } from "next-auth";

// Config "edge-safe": sem providers, sem nenhum import que toque banco de
// dados ou bcrypt. Usada exclusivamente pelo middleware, que só precisa
// decodificar/verificar o JWT da sessão — nunca autentica credenciais
// diretamente. Isso evita que Prisma Client e bcrypt entrem no bundle do
// Edge Runtime, onde o Prisma Client padrão (sem driver adapter) não roda.
export const authConfigEdge: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
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
