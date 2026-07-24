// A assinatura visual do produto: a linha de perfuração entre o canhoto e o
// corpo de um ingresso de papel. Usada só nos dois momentos que definem o
// produto — comprar (página pública) e validar (resultado do scanner) — não
// como decoração geral da UI.
export function TicketPerforation() {
  return (
    <div
      className="relative -mx-(--card-spacing,--spacing(4)) my-2"
      aria-hidden="true"
    >
      <div className="absolute top-1/2 left-0 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
      <div className="border-t border-dashed border-border" />
      <div className="absolute top-1/2 right-0 size-4 -translate-y-1/2 translate-x-1/2 rounded-full bg-background" />
    </div>
  );
}
