import { describe, expect, it } from "vitest";
import { addAttractionSchema } from "./attractionSchema";

describe("addAttractionSchema", () => {
  it("accepts a name with a photo URL", () => {
    const result = addAttractionSchema.safeParse({
      name: "DJ Teste",
      photoUrl: "https://example.com/dj.jpg",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("DJ Teste");
      expect(result.data.photoUrl).toBe("https://example.com/dj.jpg");
    }
  });

  it("accepts a name without a photo", () => {
    const result = addAttractionSchema.safeParse({
      name: "DJ Sem Foto",
      photoUrl: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.photoUrl).toBeUndefined();
    }
  });

  it("rejects a missing name", () => {
    const result = addAttractionSchema.safeParse({ name: "", photoUrl: "" });

    expect(result.success).toBe(false);
  });

  it("rejects a name that is only whitespace", () => {
    const result = addAttractionSchema.safeParse({
      name: "   ",
      photoUrl: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a photoUrl that is not a valid URL", () => {
    const result = addAttractionSchema.safeParse({
      name: "DJ Teste",
      photoUrl: "not-a-url",
    });

    expect(result.success).toBe(false);
  });
});
