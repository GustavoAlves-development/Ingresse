import { auth } from "@/auth";

// Concede visão e ações "cross-tenant" (todos os organizadores, não só o
// seu) só pra uma conta específica: a sua, dono do software — configurada
// via PLATFORM_OWNER_EMAIL na Vercel, comparando com o e-mail de login da
// sessão atual. Usado pelo dashboard de plataforma (/admin/platform) e
// pelo bypass de portaria pra eventos de outros organizadores. Todo o
// resto do sistema continua isolado por organizerId normalmente — esse
// helper é a ÚNICA exceção deliberada a essa regra.
export async function getPlatformOwnerSession() {
  const session = await auth();
  const ownerEmail = process.env.PLATFORM_OWNER_EMAIL;

  if (!session?.user?.email || !ownerEmail) {
    return null;
  }
  if (session.user.email.toLowerCase() !== ownerEmail.toLowerCase()) {
    return null;
  }

  return session;
}
