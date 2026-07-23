import type { Role } from "@prisma/client";

export function isAuthorizedForPath(
  role: Role | undefined,
  pathname: string,
): boolean {
  const normalizedPath = pathname.toLowerCase();
  if (normalizedPath.startsWith("/admin")) {
    return role === "ORGANIZER_ADMIN";
  }
  if (normalizedPath.startsWith("/portaria")) {
    return role === "ORGANIZER_ADMIN" || role === "PORTARIA_STAFF";
  }
  return true;
}
