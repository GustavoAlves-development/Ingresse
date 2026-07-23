import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createEvent } from "@/lib/db/eventRepository";
import { createEventSchema } from "@/lib/events/eventSchema";
import { slugify } from "@/lib/events/slugify";

async function createEventAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  const parsed = createEventSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    location: formData.get("location"),
    startsAt: formData.get("startsAt"),
    ticketPriceReais: formData.get("ticketPriceReais"),
    capacity: formData.get("capacity"),
  });

  if (!parsed.success) {
    redirect("/admin/events/new?error=1");
  }

  const {
    name,
    description,
    location,
    startsAt,
    ticketPriceReais,
    capacity,
  } = parsed.data;

  await createEvent(session.user.organizerId, {
    name,
    slug: slugify(name),
    description: description || undefined,
    location,
    startsAt,
    ticketPriceCents: Math.round(ticketPriceReais * 100),
    capacity,
  });

  redirect("/admin/events");
}

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-xl font-semibold">Novo evento</h1>
      {error && (
        <p className="mb-4 text-sm text-red-500">
          Verifique os campos preenchidos.
        </p>
      )}
      <form action={createEventAction} className="flex flex-col gap-4">
        <input
          name="name"
          placeholder="Nome do evento"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <textarea
          name="description"
          placeholder="Descrição (opcional)"
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="location"
          placeholder="Local"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="startsAt"
          type="datetime-local"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="ticketPriceReais"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="Preço do ingresso (R$)"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="capacity"
          type="number"
          step="1"
          min="1"
          placeholder="Capacidade"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-2 text-white"
        >
          Criar evento
        </button>
      </form>
    </main>
  );
}
