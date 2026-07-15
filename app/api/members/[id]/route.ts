import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members, circTransactions, fineRecords, reservations, copies, catalogueItems } from "@/lib/db/schema";
import { eq, desc, ne, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const memberId = parseInt(id);

  // Members can only see their own profile
  const userRole = (session.user as any).role;
  const userMemberId = (session.user as any).memberId;
  if (userRole === "member" && userMemberId !== memberId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [member] = await db.select().from(members).where(eq(members.id, memberId));
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [transactions, fines, memberReservations] = await Promise.all([
    db
      .select({
        id: circTransactions.id,
        transactionType: circTransactions.transactionType,
        issueDate: circTransactions.issueDate,
        dueDate: circTransactions.dueDate,
        returnDate: circTransactions.returnDate,
        createdAt: circTransactions.createdAt,
        copyBarcode: copies.barcode,
        title: catalogueItems.title,
      })
      .from(circTransactions)
      .innerJoin(copies, eq(circTransactions.copyId, copies.id))
      .innerJoin(catalogueItems, eq(copies.catalogueItemId, catalogueItems.id))
      .where(eq(circTransactions.memberId, memberId))
      .orderBy(desc(circTransactions.createdAt))
      .limit(50),
    db.select().from(fineRecords).where(eq(fineRecords.memberId, memberId)).orderBy(desc(fineRecords.createdAt)),
    db
      .select({
        id: reservations.id,
        status: reservations.status,
        reservedAt: reservations.reservedAt,
        expiresAt: reservations.expiresAt,
        title: catalogueItems.title,
      })
      .from(reservations)
      .innerJoin(catalogueItems, eq(reservations.catalogueItemId, catalogueItems.id))
      .where(eq(reservations.memberId, memberId)),
  ]);

  return NextResponse.json({ ...member, transactions, fines, reservations: memberReservations });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["admin","librarian","staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const memberId = parseInt(id);
  const body = await req.json();

  if (body.rollNo) {
    const [existing] = await db.select({ id: members.id, name: members.name }).from(members)
      .where(and(eq(members.rollNo, body.rollNo), ne(members.id, memberId)));
    if (existing) {
      return NextResponse.json({ error: `USN ${body.rollNo} is already registered to ${existing.name}` }, { status: 409 });
    }
  }

  const [updated] = await db
    .update(members)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(members.id, memberId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["admin"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [updated] = await db
    .update(members)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(members.id, parseInt(id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
