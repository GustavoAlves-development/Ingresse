"use client";

import { useState } from "react";
import {
  parseAsSaoPauloTime,
  toSaoPauloDatetimeLocalValue,
} from "@/lib/events/eventDateTime";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { EventShowcase, type ShowcaseAttraction } from "@/components/tickets/EventShowcase";

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Rascunho" },
  { value: "PUBLISHED", label: "Publicado" },
  { value: "CLOSED", label: "Encerrado" },
];

const nativeSelectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

// Enquanto a pessoa digita, o <input type="datetime-local"> pode estar
// incompleto (ex: só a data, sem hora) — parseAsSaoPauloTime não valida
// isso e quebraria. Aqui só tentamos formatar quando o valor já está
// completo; caso contrário o preview mostra "Data a definir".
function parsePreviewDate(value: string): Date | null {
  if (!DATETIME_LOCAL_PATTERN.test(value)) {
    return null;
  }
  try {
    return parseAsSaoPauloTime(value);
  } catch {
    return null;
  }
}

type EventForPreview = {
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  location: string;
  startsAt: Date;
  ticketPriceCents: number;
  capacity: number;
  confirmedAttendees: number | null;
  status: string;
  attractions: ShowcaseAttraction[];
};

export function EventEditFormWithPreview({
  event,
  error,
  updateAction,
}: {
  event: EventForPreview;
  error?: string;
  updateAction: (formData: FormData) => void;
}) {
  const [name, setName] = useState(event.name);
  const [description, setDescription] = useState(event.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(
    event.coverImageUrl ?? "",
  );
  const [location, setLocation] = useState(event.location);
  const [startsAtValue, setStartsAtValue] = useState(
    toSaoPauloDatetimeLocalValue(event.startsAt),
  );
  const [ticketPriceReais, setTicketPriceReais] = useState(
    (event.ticketPriceCents / 100).toFixed(2),
  );
  const [confirmedAttendeesValue, setConfirmedAttendeesValue] = useState(
    event.confirmedAttendees != null ? String(event.confirmedAttendees) : "",
  );

  const parsedPrice = parseFloat(ticketPriceReais);
  const previewPriceCents = Math.round(
    (Number.isNaN(parsedPrice) ? 0 : parsedPrice) * 100,
  );

  const parsedConfirmed = Number(confirmedAttendeesValue);
  const previewConfirmedAttendees =
    confirmedAttendeesValue === "" || Number.isNaN(parsedConfirmed)
      ? null
      : parsedConfirmed;

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
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
          <form action={updateAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Nome do evento</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="description">
                  Descrição (opcional)
                </FieldLabel>
                <Textarea
                  id="description"
                  name="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="coverImageUrl">
                  Capa do evento (opcional)
                </FieldLabel>
                <ImageUpload
                  name="coverImageUrl"
                  defaultValue={event.coverImageUrl}
                  onChange={setCoverImageUrl}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="location">Local</FieldLabel>
                <Input
                  id="location"
                  name="location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="startsAt">Data e hora</FieldLabel>
                <Input
                  id="startsAt"
                  name="startsAt"
                  type="datetime-local"
                  value={startsAtValue}
                  onChange={(event) => setStartsAtValue(event.target.value)}
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
                  value={ticketPriceReais}
                  onChange={(event) =>
                    setTicketPriceReais(event.target.value)
                  }
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
                  value={confirmedAttendeesValue}
                  onChange={(event) =>
                    setConfirmedAttendeesValue(event.target.value)
                  }
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

      <div className="lg:sticky lg:top-8">
        <p className="mb-3 text-sm font-medium text-muted-foreground">
          Pré-visualização da página pública
        </p>
        <EventShowcase
          name={name}
          location={location}
          startsAt={parsePreviewDate(startsAtValue)}
          description={description}
          coverImageUrl={coverImageUrl}
          confirmedAttendees={previewConfirmedAttendees}
          attractions={event.attractions}
          priceCents={previewPriceCents}
        >
          <Button type="button" disabled className="mt-4 w-full opacity-60">
            Comprar ingresso
          </Button>
        </EventShowcase>
      </div>
    </div>
  );
}
