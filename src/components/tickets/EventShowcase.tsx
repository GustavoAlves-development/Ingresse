import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketPerforation } from "@/components/tickets/TicketPerforation";

export type ShowcaseAttraction = {
  id: string;
  name: string;
  photoUrl: string | null;
};

// Como o evento é exibido pro comprador — usado tanto na página pública
// (/e/[slug]) quanto no preview ao vivo da edição do evento no admin, pra
// garantir que os dois nunca fiquem visualmente dessincronizados.
export function EventShowcase({
  name,
  location,
  startsAt,
  description,
  coverImageUrl,
  confirmedAttendees,
  attractions,
  priceCents,
  className = "",
  children,
}: {
  name: string;
  location: string;
  startsAt: Date | null;
  description?: string | null;
  coverImageUrl?: string | null;
  confirmedAttendees?: number | null;
  attractions: ShowcaseAttraction[];
  priceCents: number;
  className?: string;
  children?: ReactNode;
}) {
  const formattedDate = startsAt
    ? startsAt.toLocaleString("pt-BR", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      })
    : "Data a definir";

  return (
    <Card className={className}>
      {coverImageUrl && (
        <div className="relative -mx-(--card-spacing,--spacing(4)) -mt-(--card-spacing,--spacing(4)) aspect-video overflow-hidden rounded-t-xl">
          <img
            src={coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          <h1 className="absolute inset-x-0 bottom-0 p-4 font-heading text-2xl font-semibold text-foreground">
            {name}
          </h1>
        </div>
      )}
      <CardHeader>
        {!coverImageUrl && <CardTitle className="text-2xl">{name}</CardTitle>}
        <p className="text-sm text-muted-foreground">{location}</p>
        <p className="font-mono text-sm text-muted-foreground">
          {formattedDate}
        </p>
        {confirmedAttendees != null && (
          <Badge
            variant="outline"
            className="w-fit border-success/30 bg-success/15 text-success"
          >
            {confirmedAttendees} confirmados
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {description && (
          <p className="text-sm text-foreground/90">{description}</p>
        )}
        {attractions.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Atrações
            </p>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {attractions.map((attraction) => (
                <div
                  key={attraction.id}
                  className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center"
                >
                  {attraction.photoUrl ? (
                    <img
                      src={attraction.photoUrl}
                      alt=""
                      className="size-14 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-14 items-center justify-center rounded-full bg-muted text-lg font-medium text-muted-foreground">
                      {attraction.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="w-full truncate text-xs text-muted-foreground">
                    {attraction.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <TicketPerforation />
        <p className="font-mono text-2xl font-semibold text-foreground">
          R$ {(priceCents / 100).toFixed(2)}
        </p>
        {children}
      </CardContent>
    </Card>
  );
}
