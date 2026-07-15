import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reservations, members, catalogueItems } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

const STAFF_ROLES = ["admin", "librarian", "staff"];

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  const memberId = (session.user as any).memberId;
  const isStaff = STAFF_ROLES.includes(role);

  if (!isStaff && !memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where = isStaff
    ? eq(reservations.status, "active")
    : and(eq(reservations.status, "active"), eq(reservations.memberId, memberId));

  const rows = await db
    .select({
      id: reservations.id,
      reservedAt: reservations.reservedAt,
      expiresAt: reservations.expiresAt,
      status: reservations.status,
      memberId: members.id,
      memberName: members.name,
      membershipNo: members.membershipNo,
      catalogueItemId: catalogueItems.id,
      title: catalogueItems.title,
      availableCopies: catalogueItems.availableCopies,
    })
    .from(reservations)
    .innerJoin(members, eq(reservations.memberId, members.id))
    .innerJoin(catalogueItems, eq(reservations.catalogueItemId, catalogueItems.id))
    .where(where)
    .orderBy(desc(reservations.reservedAt));

  return NextResponse.json(rows);
}

const cancelSchema = z.object({
  reservationId: z.number().int(),
  action: z.enum(["cancel"]),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  const memberId = (session.user as any).memberId;
  const isStaff = STAFF_ROLES.includes(role);

  if (!isStaff && !memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const [existing] = await db.select().from(reservations).where(eq(reservations.id, parsed.data.reservationId));
  if (!existing) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  if (!isStaff && existing.memberId !== memberId) {
    return NextResponse.json({ error: "You can only cancel your own reservations" }, { status: 403 });
  }

  const [updated] = await db
    .update(reservations)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(eq(reservations.id, parsed.data.reservationId))
    .returning();

  return NextResponse.json(updated);
}
