import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createAttraction,
  deleteAttractionForOrganizer,
} from "@/lib/db/attractionRepository";
import { findEventForOrganizer, updateEvent } from "@/lib/db/eventRepository";
import { toSaoPauloDatetimeLocalValue } from "@/lib/events/eventDateTime";
import { addAttractionSchema } from "@/lib/events/attractionSchema";
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
import { ImageUpload } from "@/components/admin/ImageUpload";

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
    coverImageUrl: formData.get("coverImageUrl"),
    confirmedAttendees: formData.get("confirmedAttendees"),
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
    coverImageUrl,
    confirmedAttendees,
  } = parsed.data;

  const updated = await updateEvent(session.user.organizerId, eventId, {
    name,
    description: description || null,
    location,
    startsAt,
    ticketPriceCents: Math.round(ticketPriceReais * 100),
    capacity,
    status,
    coverImageUrl: coverImageUrl ?? null,
    confirmedAttendees: confirmedAttendees ?? null,
  });

  if (!updated) {
    notFound();
  }

  redirect("/admin/events");
}

async function addAttractionAction(eventId: string, formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  const parsed = addAttractionSchema.safeParse({
    name: formData.get("name"),
    photoUrl: formData.get("photoUrl"),
  });

  if (!parsed.success) {
    redirect(`/admin/events/${eventId}/edit?error=attraction`);
  }

  const event = await findEventForOrganizer(session.user.organizerId, eventId);
  if (!event) {
    notFound();
  }

  await createAttraction(eventId, session.user.organizerId, parsed.data);

  redirect(`/admin/events/${eventId}/edit`);
}

async function removeAttractionAction(
  eventId: string,
  attractionId: string,
) {
  "use server";

  const session = await auth();
  if (!session?.user?.organizerId) {
    redirect("/login");
  }

  await deleteAttractionForOrganizer(session.user.organizerId, attractionId);

  redirect(`/admin/events/${eventId}/edit`);
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

  const boundUpdateAction = updateEventAction.bind(null, eventId);
  const boundAddAttractionAction = addAttractionAction.bind(null, eventId);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Editar evento</CardTitle>
        </CardHeader>
        <CardContent>
          {error === "1" && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Verifique os campos preenchidos.
              </AlertDescription>
            </Alert>
          )}
          <form action={boundUpdateAction}>
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
                <FieldLabel htmlFor="coverImageUrl">
                  Capa do evento (opcional)
                </FieldLabel>
                <ImageUpload
                  name="coverImageUrl"
                  defaultValue={event.coverImageUrl}
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
                <FieldLabel htmlFor="confirmedAttendees">
                  Pessoas confirmadas (opcional)
                </FieldLabel>
                <Input
                  id="confirmedAttendees"
                  name="confirmedAttendees"
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={event.confirmedAttendees ?? ""}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Atrações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error === "attraction" && (
            <Alert variant="destructive">
              <AlertDescription>
                Verifique o nome da atração.
              </AlertDescription>
            </Alert>
          )}
          {event.attractions.length > 0 && (
            <ul className="flex flex-col gap-3">
              {event.attractions.map((attraction) => (
                <li
                  key={attraction.id}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    {attraction.photoUrl ? (
                      <img
                        src={attraction.photoUrl}
                        alt=""
                        className="size-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                        {attraction.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="text-sm font-medium">
                      {attraction.name}
                    </span>
                  </div>
                  <form
                    action={removeAttractionAction.bind(
                      null,
                      eventId,
                      attraction.id,
                    )}
                  >
                    <Button type="submit" variant="outline" size="sm">
                      Remover
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form
            action={boundAddAttractionAction}
            className="flex flex-col gap-3 border-t border-border pt-4"
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="attractionName">Nome</FieldLabel>
                <Input id="attractionName" name="name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="attractionPhoto">
                  Foto (opcional)
                </FieldLabel>
                <ImageUpload name="photoUrl" />
              </Field>
              <Button type="submit" variant="outline">
                Adicionar atração
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
