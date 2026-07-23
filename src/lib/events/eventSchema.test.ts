import { describe, expect, it } from "vitest";
import { createEventSchema, updateEventSchema } from "./eventSchema";

const validInput = {
  name: "Show da Banda X",
  description: "Um show incrível",
  location: "Curitiba, PR",
  startsAt: "2026-12-01T20:00",
  ticketPriceReais: "50.00",
  capacity: "200",
};

describe("createEventSchema", () => {
  it("accepts valid input and coerces types", () => {
    const result = createEventSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startsAt).toBeInstanceOf(Date);
      expect(result.data.ticketPriceReais).toBe(50);
      expect(result.data.capacity).toBe(200);
    }
  });

  it("rejects missing name", () => {
    const result = createEventSchema.safeParse({ ...validInput, name: "" });

    expect(result.success).toBe(false);
  });

  it("rejects zero or negative price", () => {
    const result = createEventSchema.safeParse({
      ...validInput,
      ticketPriceReais: "0",
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-integer capacity", () => {
    const result = createEventSchema.safeParse({
      ...validInput,
      capacity: "10.5",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateEventSchema", () => {
  it("accepts valid input including status", () => {
    const result = updateEventSchema.safeParse({
      ...validInput,
      status: "PUBLISHED",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid status value", () => {
    const result = updateEventSchema.safeParse({
      ...validInput,
      status: "SOMETHING_ELSE",
    });

    expect(result.success).toBe(false);
  });
});
