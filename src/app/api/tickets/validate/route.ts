import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { validateTicketForOrganizer } from "@/lib/db/ticketRepository";

const validateSchema = z.object({
  qrToken: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = validateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const { result, ticket } = await validateTicketForOrganizer(
    session.user.organizerId,
    parsed.data.qrToken,
    session.user.id,
  );

  return NextResponse.json({ result, buyerName: ticket?.buyerName ?? null });
}
