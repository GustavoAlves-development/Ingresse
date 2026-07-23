import { notFound } from "next/navigation";
import { findEventBySlug } from "@/lib/db/eventRepository";

export default async function PublicEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const { status } = await searchParams;

  const event = await findEventBySlug(slug);
  if (!event || event.status !== "PUBLISHED") {
    notFound();
  }

  const formattedDate = event.startsAt.toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <main className="mx-auto max-w-md p-8">
      {status === "success" && (
        <p className="mb-4 text-sm text-green-500">
          Pagamento em processamento! Você receberá o ingresso por e-mail
          assim que for confirmado.
        </p>
      )}
      {status === "failure" && (
        <p className="mb-4 text-sm text-red-500">
          Pagamento não foi concluído. Tente novamente.
        </p>
      )}
      <h1 className="text-2xl font-semibold">{event.name}</h1>
      <p className="text-gray-400">{event.location}</p>
      <p className="text-gray-400">{formattedDate}</p>
      {event.description && <p className="mt-4">{event.description}</p>}
      <p className="mt-4 text-lg font-semibold">
        R$ {(event.ticketPriceCents / 100).toFixed(2)}
      </p>
      <form
        action="/api/checkout"
        method="POST"
        className="mt-6 flex flex-col gap-4"
      >
        <input type="hidden" name="eventId" value={event.id} />
        <input
          name="buyerName"
          placeholder="Seu nome"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="buyerEmail"
          type="email"
          placeholder="Seu e-mail"
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <input
          name="quantity"
          type="number"
          min="1"
          max="10"
          defaultValue={1}
          required
          className="rounded border border-gray-700 bg-transparent px-3 py-2"
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-2 text-white"
        >
          Comprar ingresso
        </button>
      </form>
    </main>
  );
}
