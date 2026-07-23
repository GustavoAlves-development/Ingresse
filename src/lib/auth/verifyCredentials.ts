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
