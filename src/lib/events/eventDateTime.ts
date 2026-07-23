const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

// Converte o valor de um <input type="datetime-local"> (ex: "2026-12-01T20:00"),
// que não carrega fuso horário, assumindo que representa um horário local de
// São Paulo — o fuso de negócio da plataforma — para o instante UTC correto.
// Evita depender do fuso horário do processo Node (que varia entre a máquina
// de dev e o runtime de produção), o que faria o mesmo horário digitado virar
// instantes UTC diferentes dependendo de onde o código roda.
export function parseAsSaoPauloTime(datetimeLocalValue: string): Date {
  const [datePart, timePart] = datetimeLocalValue.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offsetMinutes = getTimeZoneOffsetMinutes(
    SAO_PAULO_TIME_ZONE,
    new Date(asUtc),
  );

  return new Date(asUtc - offsetMinutes * 60_000);
}

// Formata um instante para o valor esperado por um <input type="datetime-local">,
// exibindo o horário correspondente em São Paulo (não no fuso do processo Node).
export function toSaoPauloDatetimeLocalValue(date: Date): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: SAO_PAULO_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function getTimeZoneOffsetMinutes(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asIfUtc - date.getTime()) / 60_000;
}
