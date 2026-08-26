// Brasil aboliu o horário de verão em 2019 — América/São Paulo é UTC-3 fixo
// o ano todo agora, então dá pra calcular o deslocamento direto, sem
// depender de parsing de toLocaleString (que é frágil) nem de uma lib de
// timezone inteira só pra isso.
const SAO_PAULO_UTC_OFFSET_HOURS = -3;
const HOUR_MS = 60 * 60 * 1000;

// Retorna o intervalo [meia-noite de hoje em São Paulo, agora] em UTC —
// usado pelo relatório diário pra somar as vendas do dia até o horário de
// fechamento (22h BRT).
export function getSaoPauloDayRangeUntilNow(referenceDate = new Date()) {
  const shifted = new Date(
    referenceDate.getTime() + SAO_PAULO_UTC_OFFSET_HOURS * HOUR_MS,
  );
  const startOfDayShifted = new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const start = new Date(
    startOfDayShifted.getTime() - SAO_PAULO_UTC_OFFSET_HOURS * HOUR_MS,
  );

  return { start, end: referenceDate };
}

export function formatSaoPauloDateLabel(referenceDate = new Date()): string {
  return referenceDate.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}
