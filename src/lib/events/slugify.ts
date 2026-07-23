// Unicode "combining diacritical marks" — o intervalo que sobra depois de
// normalizar uma string acentuada em NFD (ex: "á" vira "a" + marca de
// acento separada). Construído via String.fromCodePoint (números
// hexadecimais puros) em vez de um escape \u literal no código-fonte,
// porque ferramentas de edição baseadas em JSON já decodificaram esse
// escape para o caractere Unicode real por engano nesta mesma função —
// isso evita repetir o problema.
const diacriticRangeStart = String.fromCodePoint(0x0300);
const diacriticRangeEnd = String.fromCodePoint(0x036f);
const diacriticPattern = new RegExp(
  `[${diacriticRangeStart}-${diacriticRangeEnd}]`,
  "g",
);

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(diacriticPattern, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");

  const uniqueSuffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${uniqueSuffix}`;
}
