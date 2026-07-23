type TicketEmailProps = {
  buyerName: string;
  eventName: string;
  eventLocation: string;
  eventStartsAt: Date;
  qrCodeDataUrl: string;
};

export function TicketEmail({
  buyerName,
  eventName,
  eventLocation,
  eventStartsAt,
  qrCodeDataUrl,
}: TicketEmailProps) {
  const formattedDate = eventStartsAt.toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <div style={{ fontFamily: "sans-serif", padding: "24px" }}>
      <h1>Seu ingresso para {eventName}</h1>
      <p>Olá, {buyerName}!</p>
      <p>
        {eventLocation} — {formattedDate}
      </p>
      <img
        src={qrCodeDataUrl}
        alt="QR Code do ingresso"
        width={240}
        height={240}
      />
      <p>Apresente este QR Code na entrada do evento.</p>
    </div>
  );
}
