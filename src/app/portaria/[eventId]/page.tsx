import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { findEventForOrganizer } from "@/lib/db/eventRepository";
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
  const event = await findEventForOrganizer(session.user.organizerId, eventId);
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
