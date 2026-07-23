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
