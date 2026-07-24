import { z } from "zod";

const emptyStringToUndefined = (value: unknown) =>
  value === "" ? undefined : value;

export const addAttractionSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  photoUrl: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().url("URL de imagem inválida").optional(),
  ),
});
