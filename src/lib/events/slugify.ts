export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");

  const uniqueSuffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${uniqueSuffix}`;
}
