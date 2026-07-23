import Link from "next/link";
import { auth, signOut } from "@/auth";

export default async function AdminHomePage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p>
        Logado como {session?.user?.name} ({session?.user?.role})
      </p>
      <Link href="/admin/events" className="text-blue-400 underline">
        Meus eventos
      </Link>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="rounded bg-gray-700 px-3 py-2 text-white"
        >
          Sair
        </button>
      </form>
    </main>
  );
}
