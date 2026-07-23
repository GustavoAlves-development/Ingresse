import { z } from "zod";
import { parseAsSaoPauloTime } from "./eventDateTime";

const eventFieldsSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  location: z.string().trim().min(1, "Local é obrigatório"),
  startsAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Data/hora inválida")
    .transform((value) => parseAsSaoPauloTime(value)),
  ticketPriceReais: z.coerce
    .number()
    .positive("Preço deve ser maior que zero"),
  capacity: z.coerce.number().int().positive("Capacidade deve ser maior que zero"),
});

export const createEventSchema = eventFieldsSchema;

export const updateEventSchema = eventFieldsSchema.extend({
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]),
});
