import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createEvent } from "@/lib/db/eventRepository";
import { createEventSchema } from "@/lib/events/eventSchema";
import { slugify } from "@/lib/events/slugify";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/admin/ImageUpload";

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
    coverImageUrl: formData.get("coverImageUrl"),
    confirmedAttendees: formData.get("confirmedAttendees"),
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
    coverImageUrl,
    confirmedAttendees,
  } = parsed.data;

  await createEvent(session.user.organizerId, {
    name,
    slug: slugify(name),
    description: description || undefined,
    location,
    startsAt,
    ticketPriceCents: Math.round(ticketPriceReais * 100),
    capacity,
    coverImageUrl,
    confirmedAttendees,
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
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Novo evento</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Verifique os campos preenchidos.
              </AlertDescription>
            </Alert>
          )}
          <form action={createEventAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Nome do evento</FieldLabel>
                <Input id="name" name="name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="description">
                  Descrição (opcional)
                </FieldLabel>
                <Textarea id="description" name="description" />
              </Field>
              <Field>
                <FieldLabel htmlFor="coverImageUrl">
                  Capa do evento (opcional)
                </FieldLabel>
                <ImageUpload name="coverImageUrl" />
              </Field>
              <Field>
                <FieldLabel htmlFor="location">Local</FieldLabel>
                <Input id="location" name="location" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="startsAt">Data e hora</FieldLabel>
                <Input
                  id="startsAt"
                  name="startsAt"
                  type="datetime-local"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ticketPriceReais">
                  Preço do ingresso (R$)
                </FieldLabel>
                <Input
                  id="ticketPriceReais"
                  name="ticketPriceReais"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className="font-mono"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="capacity">Capacidade</FieldLabel>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  step="1"
                  min="1"
                  required
                  className="font-mono"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirmedAttendees">
                  Pessoas confirmadas (opcional)
                </FieldLabel>
                <Input
                  id="confirmedAttendees"
                  name="confirmedAttendees"
                  type="number"
                  step="1"
                  min="0"
                  className="font-mono"
                />
              </Field>
              <Button type="submit">Criar evento</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
