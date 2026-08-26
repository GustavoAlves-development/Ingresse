import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPlatformOwnerSession } from "@/lib/auth/platformOwner";
import { findEventById, findEventForOrganizer } from "@/lib/db/eventRepository";
import { QrScanner } from "@/components/portaria/QrScanner";

export default async function PortariaScannerPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  const { eventId } = await params;
  const tenantEvent = await findEventForOrganizer(
    session.user.organizerId,
    eventId,
  );

  // Não achou dentro do próprio organizador — só o dono da plataforma
  // consegue enxergar (e escanear) portaria de evento de outro
  // organizador. Pra qualquer outra sessão, continua 404 normalmente.
  // Tipado só pelo formato que a página realmente usa (name) porque
  // findEventForOrganizer inclui attractions e findEventById não —
  // unificar os dois tipos completos não vale a pena aqui.
  let event: { name: string } | null = tenantEvent;
  if (!event) {
    const platformOwnerSession = await getPlatformOwnerSession();
    if (platformOwnerSession) {
      event = await findEventById(eventId);
    }
  }

  if (!event) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-md p-4 sm:p-8">
      <h1 className="mb-6 font-heading text-xl font-semibold">
        {event.name}
      </h1>
      <QrScanner />
    </main>
  );
}
