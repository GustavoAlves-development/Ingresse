import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listEventsByOrganizer } from "@/lib/db/eventRepository";

export default async function PortariaEventsListPage() {
  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  const events = await listEventsByOrganizer(session.user.organizerId);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-xl font-semibold">Portaria</h1>
      {events.length === 0 ? (
        <p>Nenhum evento criado ainda.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id} className="rounded border border-gray-700 p-4">
              <Link
                href={`/portaria/${event.id}`}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{event.name}</p>
                  <p className="text-sm text-gray-400">
                    {event.location} — {event.status}
                  </p>
                </div>
                <span className="text-blue-400 underline">
                  Validar ingressos
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
