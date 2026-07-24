import { notFound } from "next/navigation";
import { findEventBySlug } from "@/lib/db/eventRepository";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TicketPerforation } from "@/components/tickets/TicketPerforation";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      {status === "success" && (
        <Alert className="border-success/30 bg-success/10">
          <AlertDescription className="text-success">
            Pagamento em processamento! Você receberá o ingresso por e-mail
            assim que for confirmado.
          </AlertDescription>
        </Alert>
      )}
      {status === "failure" && (
        <Alert variant="destructive">
          <AlertDescription>
            Pagamento não foi concluído. Tente novamente.
          </AlertDescription>
        </Alert>
      )}
      <Card className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
        <CardHeader>
          <CardTitle className="text-2xl">{event.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{event.location}</p>
          <p className="font-mono text-sm text-muted-foreground">
            {formattedDate}
          </p>
        </CardHeader>
        <CardContent>
          {event.description && (
            <p className="text-sm text-foreground/90">{event.description}</p>
          )}
          <TicketPerforation />
          <p className="font-mono text-2xl font-semibold text-foreground">
            R$ {(event.ticketPriceCents / 100).toFixed(2)}
          </p>
          <form action="/api/checkout" method="POST" className="mt-4">
            <input type="hidden" name="eventId" value={event.id} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="buyerName">Seu nome</FieldLabel>
                <Input id="buyerName" name="buyerName" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="buyerEmail">Seu e-mail</FieldLabel>
                <Input
                  id="buyerEmail"
                  name="buyerEmail"
                  type="email"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="quantity">Quantidade</FieldLabel>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min={1}
                  max={10}
                  defaultValue={1}
                  required
                  className="font-mono"
                />
              </Field>
              <Button type="submit" className="w-full">
                Comprar ingresso
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
