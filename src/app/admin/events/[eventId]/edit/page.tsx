import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { findEventForOrganizer, updateEvent } from "@/lib/db/eventRepository";
import { toSaoPauloDatetimeLocalValue } from "@/lib/events/eventDateTime";
import { updateEventSchema } from "@/lib/events/eventSchema";

async function updateEventAction(eventId: string, formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  const parsed = updateEventSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    location: formData.get("location"),
    startsAt: formData.get("startsAt"),
    ticketPriceReais: formData.get("ticketPriceReais"),
    capacity: formData.get("capacity"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    redirect(`/admin/events/${eventId}/edit?error=1`);
  }

  const {
    name,
    description,
    location,
    startsAt,
    ticketPriceReais,
    capacity,
    status,
  } = parsed.data;

  const updated = await updateEvent(session.user.organizerId, eventId, {
    name,
    description: description || null,
    location,
    startsAt,
    ticketPriceCents: Math.round(ticketPriceReais * 100),
    capacity,
    status,
  });

  if (!updated) {
    notFound();
  }

  redirect("/admin/events");
}

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  const { eventId } = await params;
  const { error } = await searchParams;

  const event = await findEventForOrganizer(session.user.organizerId, eventId);
  if (!event) {
    notFound();
  }

  const boundAction = updateEventAction.bind(null, eventId);

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-xl font-semibold">Editar evento</h1>
      {error && (
        <p className="mb-4 text-sm text-red-500">
          Verifique os campos preenchidos.
        </p>
      )}
      <form action={boundAction} className="flex flex-col gap-4">
        <input
          name="name"
          defaultValue={event.name}
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <textarea
          name="description"
          defaultValue={event.description ?? ""}
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="location"
          defaultValue={event.location}
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="startsAt"
          type="datetime-local"
          defaultValue={toSaoPauloDatetimeLocalValue(event.startsAt)}
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="ticketPriceReais"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={(event.ticketPriceCents / 100).toFixed(2)}
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="capacity"
          type="number"
          step="1"
          min="1"
          defaultValue={event.capacity}
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <select
          name="status"
          defaultValue={event.status}
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        >
          <option value="DRAFT">Rascunho</option>
          <option value="PUBLISHED">Publicado</option>
          <option value="CLOSED">Encerrado</option>
        </select>
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-2 text-white"
        >
          Salvar
        </button>
      </form>
    </main>
  );
}
