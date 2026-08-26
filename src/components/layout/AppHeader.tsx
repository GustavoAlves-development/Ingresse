import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { MobileNavMenu } from "@/components/layout/MobileNavMenu";

const ROLE_LABELS: Record<string, string> = {
  ORGANIZER_ADMIN: "Organizador",
  PORTARIA_STAFF: "Portaria",
};

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export async function AppHeader() {
  const session = await auth();

  const navLinks =
    session?.user?.role === "ORGANIZER_ADMIN"
      ? [
          { href: "/admin/events", label: "Meus eventos" },
          { href: "/admin/team", label: "Equipe" },
          { href: "/portaria", label: "Portaria" },
        ]
      : session?.user
        ? [{ href: "/portaria", label: "Portaria" }]
        : [];

  const userLabel = session?.user
    ? `${session.user.name} · ${ROLE_LABELS[session.user.role] ?? session.user.role}`
    : "";

  const signOutButton = (
    <form action={signOutAction}>
      <Button type="submit" variant="secondary" size="sm">
        Sair
      </Button>
    </form>
  );

  return (
    <header className="relative border-b border-border bg-secondary">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="brand-glow font-heading text-lg font-semibold tracking-tight text-foreground"
        >
          ingresse
        </Link>
        {session?.user && (
          <>
            {/* Nav completa — some abaixo de sm e vira o menu hambúrguer */}
            <div className="hidden items-center gap-6 sm:flex">
              <nav className="flex items-center gap-4 text-sm">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {session.user.name}
                  <span className="text-muted-foreground/70">
                    {" "}
                    · {ROLE_LABELS[session.user.role] ?? session.user.role}
                  </span>
                </span>
                {signOutButton}
              </div>
            </div>

            <MobileNavMenu
              navLinks={navLinks}
              userLabel={userLabel}
              signOutSlot={signOutButton}
            />
          </>
        )}
      </div>
    </header>
  );
}
