import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reservations, catalogueItems, members } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { addDays } from "date-fns";
import { z } from "zod";

const reserveSchema = z.object({
  catalogueItemId: z.number().int(),
  memberBarcode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = reserveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  const { catalogueItemId, memberBarcode } = parsed.data;

  // Resolve member
  let memberId: number;
  if (memberBarcode) {
    const [m] = await db.select().from(members).where(eq(members.barcode, memberBarcode));
    if (!m) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    memberId = m.id;
  } else {
    memberId = (session.user as any).memberId;
    if (!memberId) return NextResponse.json({ error: "No member linked to account" }, { status: 400 });
  }

  const [item] = await db.select().from(catalogueItems).where(eq(catalogueItems.id, catalogueItemId));
  if (!item) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  // Check for duplicate reservation
  const [existing] = await db
    .select()
    .from(reservations)
    .where(and(eq(reservations.memberId, memberId), eq(reservations.catalogueItemId, catalogueItemId), eq(reservations.status, "active")));
  if (existing) return NextResponse.json({ error: "Already reserved" }, { status: 400 });

  const [reservation] = await db.insert(reservations).values({
    memberId,
    catalogueItemId,
    expiresAt: addDays(new Date(), 7),
  }).returning();

  return NextResponse.json(reservation, { status: 201 });
}
