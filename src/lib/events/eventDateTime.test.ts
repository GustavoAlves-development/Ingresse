import { describe, expect, it } from "vitest";
import { parseAsSaoPauloTime, toSaoPauloDatetimeLocalValue } from "./eventDateTime";

describe("parseAsSaoPauloTime", () => {
  it("interprets a datetime-local value as São Paulo local time (UTC-3)", () => {
    const result = parseAsSaoPauloTime("2026-12-01T20:00");

    expect(result.toISOString()).toBe("2026-12-01T23:00:00.000Z");
  });
});

describe("toSaoPauloDatetimeLocalValue", () => {
  it("formats a UTC instant back as São Paulo local time", () => {
    const date = new Date("2026-12-01T23:00:00.000Z");

    expect(toSaoPauloDatetimeLocalValue(date)).toBe("2026-12-01T20:00");
  });

  it("round-trips through parseAsSaoPauloTime", () => {
    const original = "2026-06-15T14:30";
    const parsed = parseAsSaoPauloTime(original);

    expect(toSaoPauloDatetimeLocalValue(parsed)).toBe(original);
  });
});
