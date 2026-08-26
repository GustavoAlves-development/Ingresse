// Taxa que a plataforma (você, dono do software) cobra sobre cada venda
// aprovada de qualquer organizador. Se um dia essa taxa mudar, é só
// atualizar aqui — tudo que calcula receita líquida do organizador ou
// lucro da plataforma (dashboard de vendas e relatório diário) usa essa
// mesma constante, então nunca fica dessincronizado.
export const PLATFORM_FEE_RATE = 0.1; // 10%

export function splitRevenue(grossCents: number) {
  const platformFeeCents = Math.round(grossCents * PLATFORM_FEE_RATE);
  const netCents = grossCents - platformFeeCents;
  return { grossCents, platformFeeCents, netCents };
}
