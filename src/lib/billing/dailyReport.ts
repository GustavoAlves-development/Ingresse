import { splitRevenue } from "./platformFee";

type PaidOrder = {
  organizerId: string;
  quantity: number;
  totalAmountCents: number;
  event: { name: string };
};

type Organizer = {
  id: string;
  name: string;
  email: string;
};

export type OrganizerReportLine = {
  organizerId: string;
  organizerName: string;
  organizerEmail: string;
  grossCents: number;
  platformFeeCents: number;
  netCents: number;
  ticketsSold: number;
  events: { eventName: string; grossCents: number; quantity: number }[];
};

export type DailyReport = {
  dateLabel: string;
  organizers: OrganizerReportLine[];
  totals: {
    grossCents: number;
    platformFeeCents: number;
    netCents: number;
    ticketsSold: number;
  };
};

export function buildDailyReport(
  orders: PaidOrder[],
  organizers: Organizer[],
  dateLabel: string,
): DailyReport {
  const organizerById = new Map(organizers.map((org) => [org.id, org]));

  const lineByOrganizer = new Map<string, OrganizerReportLine>();

  for (const order of orders) {
    const organizer = organizerById.get(order.organizerId);
    const existing = lineByOrganizer.get(order.organizerId);

    const line: OrganizerReportLine =
      existing ??
      {
        organizerId: order.organizerId,
        organizerName: organizer?.name ?? "Organizador desconhecido",
        organizerEmail: organizer?.email ?? "",
        grossCents: 0,
        platformFeeCents: 0,
        netCents: 0,
        ticketsSold: 0,
        events: [],
      };

    line.grossCents += order.totalAmountCents;
    line.ticketsSold += order.quantity;

    const existingEvent = line.events.find(
      (e) => e.eventName === order.event.name,
    );
    if (existingEvent) {
      existingEvent.grossCents += order.totalAmountCents;
      existingEvent.quantity += order.quantity;
    } else {
      line.events.push({
        eventName: order.event.name,
        grossCents: order.totalAmountCents,
        quantity: order.quantity,
      });
    }

    lineByOrganizer.set(order.organizerId, line);
  }

  const organizerLines = Array.from(lineByOrganizer.values())
    .map((line) => {
      const split = splitRevenue(line.grossCents);
      return {
        ...line,
        platformFeeCents: split.platformFeeCents,
        netCents: split.netCents,
      };
    })
    .sort((a, b) => b.grossCents - a.grossCents);

  const totals = organizerLines.reduce(
    (acc, line) => ({
      grossCents: acc.grossCents + line.grossCents,
      platformFeeCents: acc.platformFeeCents + line.platformFeeCents,
      netCents: acc.netCents + line.netCents,
      ticketsSold: acc.ticketsSold + line.ticketsSold,
    }),
    { grossCents: 0, platformFeeCents: 0, netCents: 0, ticketsSold: 0 },
  );

  return { dateLabel, organizers: organizerLines, totals };
}
