import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listEventsByOrganizer } from "@/lib/db/eventRepository";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  CLOSED: "Encerrado",
};

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: "border-border text-muted-foreground",
  PUBLISHED: "border-success/30 bg-success/15 text-success",
  CLOSED: "border-border bg-secondary text-secondary-foreground",
};

export default async function PortariaEventsListPage() {
  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  const events = await listEventsByOrganizer(session.user.organizerId);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 font-heading text-xl font-semibold">Portaria</h1>
      {events.length === 0 ? (
        <p className="text-muted-foreground">Nenhum evento criado ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((event) => (
            <Card key={event.id}>
              <Link
                href={`/portaria/${event.id}`}
                className="block focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{event.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {event.location}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      variant="outline"
                      className={STATUS_CLASSES[event.status]}
                    >
                      {STATUS_LABELS[event.status] ?? event.status}
                    </Badge>
                    <span className="text-sm text-primary underline underline-offset-4">
                      Validar ingressos
                    </span>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
