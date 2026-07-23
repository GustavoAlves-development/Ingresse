import NextAuth from "next-auth";
import { authConfig } from "./lib/auth/authConfig";

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
