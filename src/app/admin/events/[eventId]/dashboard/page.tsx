import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { findEventForOrganizer } from "@/lib/db/eventRepository";
import { listOrdersForEvent } from "@/lib/db/orderRepository";
import { splitRevenue } from "@/lib/billing/platformFee";
import { formatBRLFromCents } from "@/lib/format/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Aguardando pagamento",
  PAID: "Pago",
  FAILED: "Falhou",
  REFUNDED: "Reembolsado",
};

const ORDER_STATUS_CLASSES: Record<string, string> = {
  PENDING: "border-border text-muted-foreground",
  PAID: "border-success/30 bg-success/15 text-success",
  FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  REFUNDED: "border-border bg-secondary text-secondary-foreground",
};

type OrderWithTickets = Awaited<
  ReturnType<typeof listOrdersForEvent>
>[number];
type TicketSummary = OrderWithTickets["tickets"][number];

export default async function EventSalesDashboardPage({
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

  const orders = await listOrdersForEvent(session.user.organizerId, eventId);

  // Todos os números abaixo derivam da mesma lista de pedidos (já vem com
  // os tickets de cada um) — evita rodar várias queries de agregação
  // separadas pra um volume de dados que, pra esse tipo de evento, é
  // pequeno o suficiente pra computar em memória sem custo real.
  const paidOrders = orders.filter((order: OrderWithTickets) => order.status === "PAID");
  const pendingOrders = orders.filter(
    (order: OrderWithTickets) => order.status === "PENDING",
  );
  const failedOrders = orders.filter(
    (order: OrderWithTickets) => order.status === "FAILED",
  );
  const refundedOrders = orders.filter(
    (order: OrderWithTickets) => order.status === "REFUNDED",
  );

  const totalRevenueCents = paidOrders.reduce(
    (sum: number, order: OrderWithTickets) => sum + order.totalAmountCents,
    0,
  );
  const revenue = splitRevenue(totalRevenueCents);

  const allTickets = orders.flatMap((order: OrderWithTickets) => order.tickets);
  const ticketsSold = allTickets.filter(
    (ticket: TicketSummary) => ticket.status !== "CANCELLED",
  ).length;
  const ticketsCheckedIn = allTickets.filter(
    (ticket: TicketSummary) => ticket.status === "USED",
  ).length;

  const capacity = event.capacity;
  const remainingCapacity = Math.max(capacity - ticketsSold, 0);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/admin/events" className="hover:text-foreground">
              Meus eventos
            </Link>
            {" / "}
            {event.name}
          </p>
          <h1 className="font-heading text-xl font-semibold">
            Vendas — {event.name}
          </h1>
        </div>
        <Button
          render={<Link href={`/admin/events/${event.id}/edit`} />}
          nativeButton={false}
          variant="outline"
        >
          Editar evento
        </Button>
      </div>

      {/* Cartões de resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Você recebe (líquido)
            </span>
            <span className="font-heading text-lg font-semibold text-success">
              {formatBRLFromCents(revenue.netCents)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Bruto {formatBRLFromCents(revenue.grossCents)} · taxa da
              plataforma (10%) −{formatBRLFromCents(revenue.platformFeeCents)}
            </span>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Ingressos vendidos
            </span>
            <span className="font-heading text-lg font-semibold">
              {ticketsSold}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {capacity}
              </span>
            </span>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Vagas restantes
            </span>
            <span className="font-heading text-lg font-semibold">
              {remainingCapacity}
            </span>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Check-ins na portaria
            </span>
            <span className="font-heading text-lg font-semibold">
              {ticketsCheckedIn}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {ticketsSold}
              </span>
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Resumo de pedidos por status */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={ORDER_STATUS_CLASSES.PAID}>
          {paidOrders.length} pago{paidOrders.length === 1 ? "" : "s"}
        </Badge>
        <Badge variant="outline" className={ORDER_STATUS_CLASSES.PENDING}>
          {pendingOrders.length} aguardando pagamento
        </Badge>
        <Badge variant="outline" className={ORDER_STATUS_CLASSES.FAILED}>
          {failedOrders.length} falhado{failedOrders.length === 1 ? "" : "s"}
        </Badge>
        {refundedOrders.length > 0 && (
          <Badge variant="outline" className={ORDER_STATUS_CLASSES.REFUNDED}>
            {refundedOrders.length} reembolsado
            {refundedOrders.length === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      {/* Lista de pedidos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Pedidos ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-0 px-0">
          {orders.length === 0 ? (
            <p className="px-4 text-sm text-muted-foreground">
              Nenhum pedido ainda pra esse evento.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {orders.map((order: OrderWithTickets) => {
                const usedCount = order.tickets.filter(
                  (t: TicketSummary) => t.status === "USED",
                ).length;

                return (
                  <li
                    key={order.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {order.buyerName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {order.buyerEmail}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {order.createdAt.toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                          timeZone: "America/Sao_Paulo",
                        })}
                        {order.paidAt && (
                          <>
                            {" "}
                            · pago em{" "}
                            {order.paidAt.toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                              timeZone: "America/Sao_Paulo",
                            })}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                      <span className="font-mono text-sm">
                        {order.quantity}× ·{" "}
                        {formatBRLFromCents(order.totalAmountCents)}
                      </span>
                      <div className="flex items-center gap-2">
                        {order.status === "PAID" && (
                          <span className="text-xs text-muted-foreground">
                            {usedCount}/{order.tickets.length} usados
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={ORDER_STATUS_CLASSES[order.status]}
                        >
                          {ORDER_STATUS_LABELS[order.status] ?? order.status}
                        </Badge>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
