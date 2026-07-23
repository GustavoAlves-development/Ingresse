import { auth } from "@/auth";

export default async function AdminHomePage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p>
        Logado como {session?.user?.name} ({session?.user?.role})
      </p>
    </main>
  );
}
