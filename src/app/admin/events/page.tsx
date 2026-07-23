import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listEventsByOrganizer } from "@/lib/db/eventRepository";

export default async function EventsListPage() {
  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  const events = await listEventsByOrganizer(session.user.organizerId);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Meus eventos</h1>
        <Link
          href="/admin/events/new"
          className="rounded bg-blue-600 px-3 py-2 text-white"
        >
          Novo evento
        </Link>
      </div>
      {events.length === 0 ? (
        <p>Nenhum evento criado ainda.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-center justify-between rounded border border-gray-700 p-4"
            >
              <div>
                <p className="font-medium">{event.name}</p>
                <p className="text-sm text-gray-400">
                  {event.location} — {event.status}
                </p>
              </div>
              <Link
                href={`/admin/events/${event.id}/edit`}
                className="text-blue-400 underline"
              >
                Editar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
