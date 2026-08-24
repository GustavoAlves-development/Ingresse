import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listEventsByOrganizer } from "@/lib/db/eventRepository";
import { getAppUrl } from "@/lib/env/appUrl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CopyLinkButton } from "@/components/admin/CopyLinkButton";

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

export default async function EventsListPage() {
  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  const events = await listEventsByOrganizer(session.user.organizerId);
  const appUrl = getAppUrl();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Meus eventos</h1>
        <Button render={<Link href="/admin/events/new" />} nativeButton={false}>
          Novo evento
        </Button>
      </div>
      {events.length === 0 ? (
        <p className="text-muted-foreground">Nenhum evento criado ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((event) => {
            const publicUrl = `${appUrl}/e/${event.slug}`;

            return (
              <Card key={event.id}>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
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
                      <Link
                        href={`/admin/events/${event.id}/edit`}
                        className="text-sm text-primary underline underline-offset-4"
                      >
                        Editar
                      </Link>
                    </div>
                  </div>
                  {event.status === "PUBLISHED" && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {publicUrl}
                      </span>
                      <CopyLinkButton url={publicUrl} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
