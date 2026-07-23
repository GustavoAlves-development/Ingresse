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
