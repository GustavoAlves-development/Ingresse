import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    const result = slugify("Show da Banda X");
    expect(result).toMatch(/^show-da-banda-x-[a-z0-9]{6}$/);
  });

  it("removes accents", () => {
    const result = slugify("Festival de Música");
    expect(result).toMatch(/^festival-de-musica-[a-z0-9]{6}$/);
  });

  it("produces different slugs for the same name (uniqueness suffix)", () => {
    const first = slugify("Evento Repetido");
    const second = slugify("Evento Repetido");
    expect(first).not.toBe(second);
  });

  it("strips characters that are not letters, numbers, or hyphens", () => {
    const result = slugify("Evento @ 2026!");
    expect(result).toMatch(/^evento-2026-[a-z0-9]{6}$/);
  });
});
