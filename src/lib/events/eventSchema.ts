import { z } from "zod";

const eventFieldsSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  location: z.string().min(1, "Local é obrigatório"),
  startsAt: z.coerce.date(),
  ticketPriceReais: z.coerce
    .number()
    .positive("Preço deve ser maior que zero"),
  capacity: z.coerce.number().int().positive("Capacidade deve ser maior que zero"),
});

export const createEventSchema = eventFieldsSchema;

export const updateEventSchema = eventFieldsSchema.extend({
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]),
});
