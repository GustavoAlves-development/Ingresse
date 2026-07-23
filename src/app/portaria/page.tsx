import { auth } from "@/auth";

export default async function PortariaHomePage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p>
        Portaria — logado como {session?.user?.name} ({session?.user?.role})
      </p>
    </main>
  );
}
