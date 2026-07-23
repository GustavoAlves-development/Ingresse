import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfigEdge } from "./authConfig.edge";
import { verifyCredentials } from "./verifyCredentials";

export const authConfig: NextAuthConfig = {
  ...authConfigEdge,
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
};
