import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

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

  return (
    <header className="border-b border-border bg-secondary">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="brand-glow font-heading text-lg font-semibold tracking-tight text-foreground"
        >
          ingresse
        </Link>
        {session?.user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {session.user.name}
              <span className="text-muted-foreground/70">
                {" "}
                · {ROLE_LABELS[session.user.role] ?? session.user.role}
              </span>
            </span>
            <form action={signOutAction}>
              <Button type="submit" variant="secondary" size="sm">
                Sair
              </Button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
