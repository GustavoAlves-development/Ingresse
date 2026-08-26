import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EventStatus } from "@prisma/client";
import { auth } from "@/auth";
import { getPlatformOwnerSession } from "@/lib/auth/platformOwner";
import { listAllEventsForPlatform } from "@/lib/db/eventRepository";
import { listAllOrganizers } from "@/lib/db/organizerRepository";
import { splitRevenue } from "@/lib/billing/platformFee";
import { formatBRLFromCents } from "@/lib/format/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const SELECT_CLASSES =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function parseDateStartOfDay(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00-03:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseDateEndOfDay(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T23:59:59-03:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function PlatformDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    organizerId?: string;
    status?: string;
    search?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const ownerSession = await getPlatformOwnerSession();
  if (!ownerSession) {
    const session = await auth();
    if (!session?.user) redirect("/login");
    notFound();
  }

  const filters = await searchParams;
  const statusFilter =
    filters.status && filters.status in EventStatus
      ? (filters.status as EventStatus)
      : undefined;

  const [events, organizers] = await Promise.all([
    listAllEventsForPlatform({
      organizerId: filters.organizerId || undefined,
      status: statusFilter,
      search: filters.search || undefined,
      startsAtFrom: parseDateStartOfDay(filters.from),
      startsAtTo: parseDateEndOfDay(filters.to),
    }),
    listAllOrganizers(),
  ]);

  type EventWithSales = (typeof events)[number];
  type Row = {
    event: EventWithSales;
    grossCents: number;
    split: ReturnType<typeof splitRevenue>;
    ticketsSold: number;
  };

  const rows: Row[] = events.map((event: EventWithSales) => {
    const grossCents = event.orders.reduce(
      (sum: number, order: { totalAmountCents: number }) =>
        sum + order.totalAmountCents,
      0,
    );
    const split = splitRevenue(grossCents);
    const ticketsSold = event._count.tickets;

    return { event, grossCents, split, ticketsSold };
  });

  const initialTotals = {
    grossCents: 0,
    platformFeeCents: 0,
    netCents: 0,
    ticketsSold: 0,
  };

  const totals = rows.reduce(
    (acc: typeof initialTotals, row: Row) => ({
      grossCents: acc.grossCents + row.grossCents,
      platformFeeCents: acc.platformFeeCents + row.split.platformFeeCents,
      netCents: acc.netCents + row.split.netCents,
      ticketsSold: acc.ticketsSold + row.ticketsSold,
    }),
    initialTotals,
  );

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <div>
        <p className="text-sm text-muted-foreground">Dono da plataforma</p>
        <h1 className="font-heading text-xl font-semibold">
          Todos os eventos
        </h1>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="search">
                Buscar por nome
              </label>
              <input
                id="search"
                name="search"
                defaultValue={filters.search ?? ""}
                placeholder="Nome do evento"
                className={SELECT_CLASSES}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="organizerId">
                Organizador
              </label>
              <select
                id="organizerId"
                name="organizerId"
                defaultValue={filters.organizerId ?? ""}
                className={SELECT_CLASSES}
              >
                <option value="">Todos</option>
                {organizers.map((org: { id: string; name: string }) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={filters.status ?? ""}
                className={SELECT_CLASSES}
              >
                <option value="">Todos</option>
                <option value="DRAFT">Rascunho</option>
                <option value="PUBLISHED">Publicado</option>
                <option value="CLOSED">Encerrado</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="from">
                Evento a partir de
              </label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={filters.from ?? ""}
                className={SELECT_CLASSES}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="to">
                Evento até
              </label>
              <input
                id="to"
                name="to"
                type="date"
                defaultValue={filters.to ?? ""}
                className={SELECT_CLASSES}
              />
            </div>

            <div className="flex items-end gap-2 lg:col-span-5">
              <Button type="submit">Filtrar</Button>
              <Button
                type="button"
                variant="outline"
                render={<Link href="/admin/platform" />}
                nativeButton={false}
              >
                Limpar filtros
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Totais do filtro atual */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Eventos</span>
            <span className="font-heading text-lg font-semibold">
              {rows.length}
            </span>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Vendido (bruto)
            </span>
            <span className="font-heading text-lg font-semibold">
              {formatBRLFromCents(totals.grossCents)}
            </span>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Sua comissão (10%)
            </span>
            <span className="font-heading text-lg font-semibold text-success">
              {formatBRLFromCents(totals.platformFeeCents)}
            </span>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Ingressos vendidos
            </span>
            <span className="font-heading text-lg font-semibold">
              {totals.ticketsSold}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Lista de eventos */}
      <Card>
        <CardContent className="flex flex-col gap-0 px-0">
          {rows.length === 0 ? (
            <p className="px-4 text-sm text-muted-foreground">
              Nenhum evento encontrado com esses filtros.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {rows.map(({ event, grossCents, split, ticketsSold }: Row) => (
                <li
                  key={event.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{event.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {event.organizer.name} · {event.location}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {event.startsAt.toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "America/Sao_Paulo",
                      })}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:flex-col sm:items-end">
                    <Badge variant="outline" className={STATUS_CLASSES[event.status]}>
                      {STATUS_LABELS[event.status] ?? event.status}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {ticketsSold}/{event.capacity} vendidos
                    </span>
                    <span className="font-mono text-sm">
                      {formatBRLFromCents(grossCents)}
                      <span className="text-muted-foreground">
                        {" "}
                        (comissão {formatBRLFromCents(split.platformFeeCents)})
                      </span>
                    </span>
                    <Link
                      href={`/portaria/${event.id}`}
                      className="text-sm text-primary underline underline-offset-4"
                    >
                      Portaria
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
