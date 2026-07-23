import bcrypt from "bcryptjs";
import { findUserByEmail } from "@/lib/db/userRepository";
import { verifyPassword } from "./password";

// Hash dummy pré-computado (mesmo custo dos hashes reais) usado só para
// igualar o tempo de resposta quando o e-mail não existe — evita que um
// atacante meça timing para diferenciar "e-mail inexistente" de "senha
// errada"; ambos os casos devem pagar o mesmo custo de bcrypt antes de
// retornar null.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "dummy-password-for-timing-safety",
  12,
);

export async function verifyCredentials(email: string, password: string) {
  const user = await findUserByEmail(email);

  const passwordMatches = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !passwordMatches) {
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
