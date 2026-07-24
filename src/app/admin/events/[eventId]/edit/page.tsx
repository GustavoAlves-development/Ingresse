import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { findEventForOrganizer, updateEvent } from "@/lib/db/eventRepository";
import { toSaoPauloDatetimeLocalValue } from "@/lib/events/eventDateTime";
import { updateEventSchema } from "@/lib/events/eventSchema";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Rascunho" },
  { value: "PUBLISHED", label: "Publicado" },
  { value: "CLOSED", label: "Encerrado" },
];

const nativeSelectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

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
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Editar evento</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Verifique os campos preenchidos.
              </AlertDescription>
            </Alert>
          )}
          <form action={boundAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Nome do evento</FieldLabel>
                <Input id="name" name="name" defaultValue={event.name} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="description">
                  Descrição (opcional)
                </FieldLabel>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={event.description ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="location">Local</FieldLabel>
                <Input
                  id="location"
                  name="location"
                  defaultValue={event.location}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="startsAt">Data e hora</FieldLabel>
                <Input
                  id="startsAt"
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={toSaoPauloDatetimeLocalValue(event.startsAt)}
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
                  defaultValue={(event.ticketPriceCents / 100).toFixed(2)}
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
                  defaultValue={event.capacity}
                  required
                  className="font-mono"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="status">Status</FieldLabel>
                <select
                  id="status"
                  name="status"
                  defaultValue={event.status}
                  className={nativeSelectClassName}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Button type="submit">Salvar</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
